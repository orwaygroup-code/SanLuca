import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

/**
 * GET /api/admin/menu/:id/usage — nº de ventas históricas (renglones ComandaItem) que
 * referencian este platillo. Sirve para avisar el impacto antes de eliminar: las ventas
 * SIEMPRE se conservan (snapshots), esto solo informa cuántas hay. ADMIN.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const salesCount = await prisma.comandaItem.count({ where: { tenantId: TENANT, dishId: params.id } });
  return NextResponse.json<ApiResponse>({ success: true, data: { salesCount } });
}
