import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/link-employee — #4 Ligar una cuenta (para llevar) a un empleado.
 * Body: { employeeId: number | null }. null = desligar. La cuenta queda PENDING de que el
 * empleado la apruebe con su PIN antes de que caja pueda cobrarla a crédito. requireCashier.
 * Reglas: solo cuentas activas SIN mesa (para llevar) y sin pagos. No se puede cambiar el
 * empleado una vez APROBADA (hay que desligar primero, lo que la regresa a sin ligar).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja (Operación/Capitán/Manager)" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const employeeId = body?.employeeId == null ? null : Number(body.employeeId);
  if (employeeId != null && !Number.isInteger(employeeId)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "employeeId inválido" }, { status: 400 });
  }

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, status: true, tableId: true, amountPaid: true },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (comanda.tableId != null) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Solo se ligan cuentas para llevar (sin mesa)" }, { status: 409 });
  }
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: no se puede ligar` }, { status: 409 });
  }
  if (Number(comanda.amountPaid) > 0.005) {
    return NextResponse.json<ApiResponse>({ success: false, error: "La cuenta ya tiene pagos; no se puede ligar" }, { status: 409 });
  }

  if (employeeId != null) {
    const emp = await prisma.staff.findFirst({
      where: { id: employeeId, tenantId: TENANT, active: true, username: { not: "llevar" } },
      select: { id: true },
    });
    if (!emp) return NextResponse.json<ApiResponse>({ success: false, error: "Empleado no encontrado o inactivo" }, { status: 404 });
  }

  await prisma.comanda.update({
    where: { id },
    data: employeeId == null
      ? { chargedEmployeeId: null, employeeChargeStatus: null, employeeChargeApprovedAt: null }
      : { chargedEmployeeId: employeeId, employeeChargeStatus: "PENDING", employeeChargeApprovedAt: null },
  });

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
