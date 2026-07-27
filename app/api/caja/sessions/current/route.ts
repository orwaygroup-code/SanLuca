import { NextRequest, NextResponse } from "next/server";
import { requireCashier } from "@/lib/dualAuth";
import { getOpenSession, buildCut } from "@/lib/caja";
import type { ApiResponse } from "@/types";

/**
 * GET /api/caja/sessions/current — turno abierto + corte X (en vivo). requireCashier.
 * Devuelve { session, cut } o { session: null } si no hay turno abierto (la UI
 * muestra "Abrir cajón"). El corte X no congela nada — es el estado del momento.
 */
export async function GET(request: NextRequest) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });

  const session = await getOpenSession();
  if (!session) return NextResponse.json<ApiResponse>({ success: true, data: { session: null, cut: null } });

  const cut = await buildCut(session.id);
  return NextResponse.json<ApiResponse>({ success: true, data: { session, cut } });
}
