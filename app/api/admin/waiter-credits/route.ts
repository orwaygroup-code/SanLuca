// app/api/admin/waiter-credits/route.ts
// Lista las cuentas a crédito de meseros (por cobrar / pagadas). Para revisar y
// descontar de nómina. requireCashier (OPERATION/CAPTAIN/MANAGER/ADMIN).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const status = new URL(request.url).searchParams.get("status"); // OUTSTANDING | PAID | VOIDED | (todo)
  // "todo" (sin filtro explícito) excluye los VOIDED: un crédito anulado al reabrir
  // la cuenta ya no es deuda. Se puede pedir explícitamente con ?status=VOIDED.
  const where = {
    tenantId: TENANT,
    ...(status === "PAID" || status === "OUTSTANDING" || status === "VOIDED"
      ? { status }
      : { status: { not: "VOIDED" } }),
  };

  const credits = await prisma.waiterCredit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, amount: true, status: true, note: true, createdAt: true, paidAt: true,
      waiter: { select: { id: true, fullName: true } },
      comanda: { select: { folio: true } },
      authorizedBy: { select: { fullName: true } },
    },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: credits });
}
