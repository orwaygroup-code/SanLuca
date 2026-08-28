import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES } from "@/lib/comanda";
import { round2 } from "@/lib/comandaTotals";
import { getOpenSession } from "@/lib/caja";
import { pushToStaff } from "@/lib/notify";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/staff-credit/request { employeeId } — Cobrar por CRÉDITO DE PERSONAL
 * con confirmación DESDE LA TABLET del empleado. Caja lo inicia: crea un StaffCreditConfirm
 * PENDING por el saldo restante y le manda una notificación al empleado. La cuenta queda
 * pendiente; se cobra sola cuando el empleado confirme con su PIN (ver credit-confirms/confirm).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado" }, { status: 409 });

  const session = await getOpenSession();
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Abre un turno antes de cobrar" }, { status: 409 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const employeeId = Number(body?.employeeId);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Elige el empleado" }, { status: 400 });
  }

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, folio: true, status: true, total: true, amountPaid: true, customName: true, table: { select: { number: true } } },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: no se puede cobrar` }, { status: 409 });
  }
  const billPrints = await prisma.comandaPrint.count({ where: { comandaId: id, type: "CUSTOMER_FINAL" } });
  if (billPrints === 0) return NextResponse.json<ApiResponse>({ success: false, error: "Imprime la cuenta antes de cobrar" }, { status: 409 });

  const remaining = round2(Number(comanda.total) - Number(comanda.amountPaid));
  if (remaining <= 0) return NextResponse.json<ApiResponse>({ success: false, error: "La cuenta ya está saldada" }, { status: 409 });

  const emp = await prisma.staff.findFirst({ where: { id: employeeId, tenantId: TENANT, active: true, username: { not: "llevar" } }, select: { id: true, fullName: true } });
  if (!emp) return NextResponse.json<ApiResponse>({ success: false, error: "Empleado no encontrado o inactivo" }, { status: 404 });

  // Una sola confirmación viva por comanda: cancela cualquiera PENDING previa.
  await prisma.staffCreditConfirm.updateMany({ where: { tenantId: TENANT, comandaId: id, status: "PENDING" }, data: { status: "CANCELLED" } });

  const req = await prisma.staffCreditConfirm.create({
    data: { tenantId: TENANT, comandaId: id, employeeId, amount: remaining, createdById: a.staffId, status: "PENDING" },
    select: { id: true },
  });

  const label = comanda.table ? `Mesa ${comanda.table.number}` : (comanda.customName || comanda.folio);
  void pushToStaff(employeeId, { title: "Confirmar crédito", body: `${label} · $${remaining.toFixed(2)} a tu crédito de personal`, url: "/staff/wallet" });

  return NextResponse.json<ApiResponse>({ success: true, data: { id: req.id, amount: remaining, employee: emp.fullName } });
}
