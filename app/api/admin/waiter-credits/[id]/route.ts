// app/api/admin/waiter-credits/[id]/route.ts
// Marca una cuenta a crédito como PAGADA (al descontarla de nómina) o la reabre.
// requireCashier.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const status = body?.status === "PAID" ? "PAID" : body?.status === "OUTSTANDING" ? "OUTSTANDING" : null;
  if (!status) return NextResponse.json<ApiResponse>({ success: false, error: "Estado inválido" }, { status: 400 });

  const credit = await prisma.waiterCredit.findFirst({ where: { id, tenantId: TENANT }, select: { id: true } });
  if (!credit) return NextResponse.json<ApiResponse>({ success: false, error: "Crédito no encontrado" }, { status: 404 });

  const updated = await prisma.waiterCredit.update({
    where: { id },
    data: { status, paidAt: status === "PAID" ? new Date() : null },
    select: { id: true, status: true, paidAt: true },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
