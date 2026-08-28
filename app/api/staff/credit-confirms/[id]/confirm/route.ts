import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/dualAuth";
import { verifyWaiterPin } from "@/lib/staff";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE, settleComanda } from "@/lib/comanda";
import { round2 } from "@/lib/comandaTotals";
import { getOpenSession } from "@/lib/caja";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/staff/credit-confirms/:id/confirm { pin } — el empleado CONFIRMA con su PIN el
 * cobro a su crédito de personal (desde su tablet, o desde caja). Ejecuta el cobro: registra
 * el pago WAITER_CREDIT + el WaiterCredit (su deuda) + salda la comanda. Marca CONFIRMED.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const pin = typeof body?.pin === "string" ? body.pin : "";

  const req = await prisma.staffCreditConfirm.findFirst({ where: { id, tenantId: TENANT }, select: { id: true, comandaId: true, employeeId: true, amount: true, status: true, createdById: true } });
  if (!req) return NextResponse.json<ApiResponse>({ success: false, error: "Solicitud no encontrada" }, { status: 404 });
  if (req.status !== "PENDING") return NextResponse.json<ApiResponse>({ success: false, error: "Esta solicitud ya no está pendiente" }, { status: 409 });

  // Autoriza el PROPIO empleado con su PIN (funciona desde su tablet o desde caja).
  if (!(await verifyWaiterPin(req.employeeId, pin))) {
    return NextResponse.json<ApiResponse>({ success: false, error: "PIN incorrecto" }, { status: 403 });
  }

  const session = await getOpenSession();
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "No hay turno de caja abierto" }, { status: 409 });

  const comanda = await prisma.comanda.findFirst({ where: { id: req.comandaId, tenantId: TENANT }, select: { id: true, status: true, total: true, amountPaid: true, tipTotal: true } });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    await prisma.staffCreditConfirm.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json<ApiResponse>({ success: false, error: `La cuenta ya está ${comanda.status}` }, { status: 409 });
  }

  const remaining = round2(Number(comanda.total) - Number(comanda.amountPaid));
  const amount = round2(Math.min(Number(req.amount), remaining));
  if (amount <= 0) {
    await prisma.staffCreditConfirm.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json<ApiResponse>({ success: false, error: "La cuenta ya está saldada" }, { status: 409 });
  }
  const newAmountPaid = round2(Number(comanda.amountPaid) + amount);
  const settled = newAmountPaid >= round2(Number(comanda.total)) - 0.005;

  await prisma.$transaction(async (tx) => {
    await tx.comandaPayment.create({
      data: { tenantId: TENANT, comandaId: req.comandaId, cashSessionId: session.id, method: "WAITER_CREDIT", amount, received: 0, changeGiven: 0, tip: 0, reference: "Crédito de personal (confirmado)", receivedById: req.createdById },
    });
    await tx.waiterCredit.create({
      data: { tenantId: TENANT, waiterId: req.employeeId, comandaId: req.comandaId, cashSessionId: session.id, amount, authorizedById: req.employeeId },
    });
    await tx.comanda.update({
      where: { id: req.comandaId },
      data: { amountPaid: newAmountPaid, ...(settled ? {} : { status: "PARTIALLY_PAID", cashSessionId: session.id }) },
    });
    if (settled) await settleComanda(tx, req.comandaId, req.createdById, session.id);
    await tx.staffCreditConfirm.update({ where: { id }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
  });

  const updated = await prisma.comanda.findFirst({ where: { id: req.comandaId, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: { settled, comanda: updated } });
}
