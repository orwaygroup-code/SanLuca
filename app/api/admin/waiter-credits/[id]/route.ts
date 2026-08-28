// app/api/admin/waiter-credits/[id]/route.ts
// Marca una cuenta a crédito de personal como PAGADA (al descontarla de nómina) o la reabre.
// Requiere PIN de MANAGER (queda quién autorizó) y deja registro en auditoría (notificación).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { verifySupervisorPin } from "@/lib/staff";
import { TENANT } from "@/lib/comanda";
import { notify } from "@/lib/notify";
import type { ApiResponse } from "@/types";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const status = body?.status === "PAID" ? "PAID" : body?.status === "OUTSTANDING" ? "OUTSTANDING" : null;
  if (!status) return NextResponse.json<ApiResponse>({ success: false, error: "Estado inválido" }, { status: 400 });

  // PIN de MANAGER obligatorio (queda registrado quién autorizó).
  const authPin = typeof body?.authPin === "string" ? body.authPin : "";
  const managerId = await verifySupervisorPin(authPin, { tenantId: TENANT, roles: ["MANAGER"] });
  if (!managerId) return NextResponse.json<ApiResponse>({ success: false, error: "PIN de Manager inválido" }, { status: 403 });

  const credit = await prisma.waiterCredit.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, amount: true, waiter: { select: { fullName: true } } },
  });
  if (!credit) return NextResponse.json<ApiResponse>({ success: false, error: "Crédito no encontrado" }, { status: 404 });

  const updated = await prisma.waiterCredit.update({
    where: { id },
    data: { status, paidAt: status === "PAID" ? new Date() : null, paidById: status === "PAID" ? managerId : null },
    select: { id: true, status: true, paidAt: true },
  });

  const manager = await prisma.staff.findUnique({ where: { id: managerId }, select: { fullName: true } });
  void notify({
    roles: ["MANAGER"],
    type: "audit",
    title: status === "PAID" ? "Crédito de personal pagado" : "Crédito reabierto",
    body: `${credit.waiter?.fullName ?? "empleado"} · $${Number(credit.amount).toFixed(2)}${manager?.fullName ? ` · por ${manager.fullName}` : ""}`,
    url: "/admin/creditos",
  });

  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
