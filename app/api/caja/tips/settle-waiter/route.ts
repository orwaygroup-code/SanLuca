import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES } from "@/lib/comanda";
import { FISCAL } from "@/lib/fiscal";
import { round2 } from "@/lib/comandaTotals";
import { getOpenSession } from "@/lib/caja";
import { loadWaiterBase, normalizePolicy, computeWaiterSettlement } from "@/lib/tips";
import { verifyWaiterPin } from "@/lib/staff";
import type { ApiResponse } from "@/types";

/**
 * POST /api/caja/tips/settle-waiter — liquida la propina de UN mesero en el turno
 * abierto. Todo el cálculo es server-side (ignora montos del cliente). Body:
 *   { waiterId, pin, cashReceived? }
 * - `pin` = PIN del PROPIO mesero (lo autoriza sin cambiar de sesión).
 * - `cashReceived` solo aplica cuando la dirección es COLLECT (el mesero completa
 *   en efectivo el faltante del 7%); se calcula el cambio.
 * - Bloquea si el mesero aún tiene cuentas activas. Una liquidación por turno/mesero.
 */
export async function POST(request: NextRequest) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado" }, { status: 409 });

  const session = await getOpenSession();
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "No hay un turno abierto" }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const waiterId = Number(body?.waiterId);
  const pin = typeof body?.pin === "string" ? body.pin : "";
  if (!Number.isInteger(waiterId) || waiterId <= 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Mesero inválido" }, { status: 400 });
  }

  // 1) El mesero no debe tener cuentas activas (todas cerradas/cobradas).
  const active = await prisma.comanda.count({
    where: { tenantId: TENANT, waiterId, status: { in: [...ACTIVE_STATUSES] } },
  });
  if (active > 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "El mesero aún tiene cuentas sin cerrar/cobrar" }, { status: 409 });
  }

  // 2) ¿Ya liquidado en este turno?
  // 3) PIN del propio mesero (autorización).
  const okPin = await verifyWaiterPin(waiterId, pin);
  if (!okPin) {
    return NextResponse.json<ApiResponse>({ success: false, error: "PIN del mesero incorrecto" }, { status: 403 });
  }

  // 4) Cálculo server-side desde la base del turno.
  const base = await loadWaiterBase(session.id);
  const w = base.find((x) => x.waiterId === waiterId);
  if (!w) {
    return NextResponse.json<ApiResponse>({ success: false, error: "El mesero no tiene ventas en este turno" }, { status: 409 });
  }
  const settings = await prisma.restaurantSettings.findUnique({ where: { tenantId: TENANT }, select: { tipPolicy: true } });
  const policy = normalizePolicy(settings?.tipPolicy);
  const calc = computeWaiterSettlement(w.salesTotal, policy.pointPercent, w.reserveDigital);

  // 5) ¿Ya liquidado? Solo se permite RE-liquidar si vendió MÁS después (su venta
  //    actual supera la que se liquidó). Si no cambió, no hay nada que rehacer.
  const existing = await prisma.waiterTipSettlement.findUnique({
    where: { cashSessionId_waiterId: { cashSessionId: session.id, waiterId } },
  });
  if (existing && w.salesTotal <= Number(existing.salesTotal) + 0.005) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Este mesero ya está liquidado en este turno" }, { status: 409 });
  }

  // 6) COLLECT: valida efectivo recibido y calcula cambio.
  let cashReceived: number | null = null;
  let changeGiven = 0;
  if (calc.direction === "COLLECT") {
    if (body?.cashReceived == null) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Falta el efectivo recibido del mesero" }, { status: 400 });
    }
    cashReceived = round2(Number(body.cashReceived));
    if (!Number.isFinite(cashReceived) || cashReceived < calc.amount - 0.005) {
      return NextResponse.json<ApiResponse>({ success: false, error: `El efectivo recibido es menor a lo que debe ($${calc.amount.toFixed(2)})` }, { status: 400 });
    }
    changeGiven = round2(Math.max(0, cashReceived - calc.amount));
  }

  const settlementData = {
    tenantId: TENANT,
    cashSessionId: session.id,
    waiterId,
    salesTotal: calc.salesTotal,
    pointPercent: policy.pointPercent,
    deduction: calc.deduction,
    reserveCard: calc.reserve,
    net: calc.net,
    direction: calc.direction,
    amount: calc.amount,
    cashReceived,
    changeGiven,
    settledById: a.staffId,
    ...(existing ? { notes: `Re-liquidado (venta previa ${Number(existing.salesTotal).toFixed(2)})` } : {}),
  };
  const include = { waiter: { select: { fullName: true } }, settledBy: { select: { fullName: true } } };

  // Re-liquidación = reemplaza la anterior (delete + create atómico) para recalcular
  // sobre la venta actual; el neto refleja el total final (caja concilia el delta físico).
  const created = existing
    ? await prisma.$transaction(async (tx) => {
        await tx.waiterTipSettlement.delete({ where: { id: existing.id } });
        return tx.waiterTipSettlement.create({ data: settlementData, include });
      })
    : await prisma.waiterTipSettlement.create({ data: settlementData, include });

  // Ticket de liquidación (a CAJA). Fire-and-forget: si falla el encolado, la
  // liquidación YA quedó guardada — no se tumba por un problema de impresión.
  try {
    await prisma.comandaPrint.create({
      data: {
        tenantId: TENANT,
        comandaId: null,
        type: "TIP_SETTLEMENT",
        target: "CAJA",
        executedById: a.staffId,
        status: "PENDING",
        payload: {
          kind: "tips",
          fiscal: FISCAL,
          folio: session.folio,
          waiter: created.waiter?.fullName ?? "",
          settledBy: created.settledBy?.fullName ?? "",
          time: new Date().toISOString(),
          resettled: !!existing,
          pointPercent: policy.pointPercent,
          salesTotal: calc.salesTotal,
          reserve: calc.reserve,
          deduction: calc.deduction,
          net: calc.net,
          direction: calc.direction,
          amount: calc.amount,
          cashReceived,
          changeGiven,
        },
      },
    });
  } catch (e) {
    console.error("[TIPS] no se pudo encolar el ticket de liquidación:", e);
  }

  return NextResponse.json<ApiResponse>({ success: true, data: { settlement: created, changeGiven, resettled: !!existing } });
}
