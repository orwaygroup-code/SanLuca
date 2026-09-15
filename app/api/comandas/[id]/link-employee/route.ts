import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE } from "@/lib/comanda";
import { round2 } from "@/lib/comandaTotals";
import { applyEmployeeDiscount, removeEmployeeDiscount } from "@/lib/employeeDiscount";
import { notify, pushToStaff } from "@/lib/notify";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/link-employee — liga una cuenta a un empleado para cobrarla
 * a crédito de personal. Body: { employeeId: number | null }. null = desligar.
 * Al ligar: se aplica el descuento de empleado en el servidor y se avisa a la tablet
 * del empleado; la cuenta queda PENDING de que él la apruebe con su PIN antes de que
 * caja la cobre a crédito. Cualquier cuenta activa y sin pagos (con o sin mesa).
 * requireCashier. No se puede cambiar el empleado sin desligar primero.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja (Operación/Capitán/Manager)" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const employeeId = body?.employeeId == null ? null : Number(body.employeeId);
  if (employeeId != null && !Number.isInteger(employeeId)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "employeeId inválido" }, { status: 400 });
  }

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, status: true, amountPaid: true, folio: true, customName: true, total: true, table: { select: { number: true } } },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: no se puede ligar` }, { status: 409 });
  }
  if (Number(comanda.amountPaid) > 0.005) {
    return NextResponse.json<ApiResponse>({ success: false, error: "La cuenta ya tiene pagos; no se puede ligar" }, { status: 409 });
  }

  if (employeeId != null) {
    const emp = await prisma.staff.findFirst({
      where: { id: employeeId, tenantId: TENANT, active: true, username: { not: "llevar" } },
      select: { id: true, fullName: true },
    });
    if (!emp) return NextResponse.json<ApiResponse>({ success: false, error: "Empleado no encontrado o inactivo" }, { status: 404 });

    // Aplicar el descuento de empleado al ligar. Si hay un descuento de supervisor
    // vigente, NO se liga (ese descuento manda). "none" es válido: cuenta vacía →
    // el descuento se aplicará al imprimir (ver /print).
    const d = await applyEmployeeDiscount(id, a.staffId);
    if (d === "supervisor") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "La cuenta ya tiene un descuento autorizado por un supervisor; retíralo antes de ligarla a un empleado" },
        { status: 409 },
      );
    }

    await prisma.comanda.update({
      where: { id },
      data: { chargedEmployeeId: employeeId, employeeChargeStatus: "PENDING", employeeChargeApprovedAt: null },
    });

    // Releer totales frescos (el descuento pudo cambiar el total) para el aviso.
    const fresh = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, select: { total: true, amountPaid: true } });
    const remaining = Math.max(0, round2(Number(fresh?.total ?? comanda.total) - Number(fresh?.amountPaid ?? 0)));
    const label = comanda.table ? `Mesa ${comanda.table.number}` : (comanda.customName || comanda.folio);
    void pushToStaff(employeeId, { title: "Cuenta por aprobar", body: `${label} · $${remaining.toFixed(2)} a tu crédito de personal`, url: "/staff/wallet" });

    const who = await prisma.staff.findUnique({ where: { id: a.staffId }, select: { fullName: true } });
    void notify({ roles: ["MANAGER"], type: "audit", title: "Cuenta ligada a empleado", body: `${comanda.folio} · ${emp.fullName} · por ${who?.fullName ?? "?"}`, url: "/admin/comandas" });
  } else {
    // Desligar: quitar el descuento de empleado y limpiar los tres campos.
    await removeEmployeeDiscount(id);
    await prisma.comanda.update({
      where: { id },
      data: { chargedEmployeeId: null, employeeChargeStatus: null, employeeChargeApprovedAt: null },
    });
  }

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
