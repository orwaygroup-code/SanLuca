import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import { buildCut, CASH_SESSION_INCLUDE } from "@/lib/caja";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * GET /api/caja/sessions/:id — una sesión + su corte. requireCashier.
 * Si está CLOSED el corte recomputado coincide con cutSnapshot (los pagos ya no
 * cambian); se recalcula para uniformidad.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const session = await prisma.cashSession.findFirst({
    where: { id, tenantId: TENANT },
    include: CASH_SESSION_INCLUDE,
  });
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Turno no encontrado" }, { status: 404 });

  const cut = await buildCut(id);
  return NextResponse.json<ApiResponse>({ success: true, data: { session, cut } });
}
