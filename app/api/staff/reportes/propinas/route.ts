import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TENANT } from "@/lib/comanda";
import { requireCashier } from "@/lib/dualAuth";
import { resolveDateRange } from "@/lib/dateRange";
import { buildTipsForSession, aggregateTipsRange } from "@/lib/tipsReport";
import type { ApiResponse } from "@/types";

/**
 * GET /api/staff/reportes/propinas?from=&to= — reparto de propinas del RANGO,
 * turno cerrado por turno cerrado.
 *
 * Guard `requireCashier`: ADMIN (sl_session) u OPERATION/CAPTAIN/MANAGER (sl_staff),
 * excluye a WAITER — el mismo de la Caja embebida, para que el manager lo vea dentro del
 * panel sin PIN. Detalle: exige `staffId != null`, así que un ADMIN sin Staff vinculado → 403.
 *
 * Solo turnos CERRADOS: ver /api/staff/reportes. Por cada corte corre
 * `buildTipsForSession` (que para meseros liquidados usa la liquidación, no un
 * recálculo) y suma con `aggregateTipsRange`.
 *
 * TECHO DURO de 60 cortes: cada `buildTipsForSession` dispara varias consultas y
 * se ejecutan en paralelo sobre una caja de dos núcleos. Sin el techo, alguien
 * pide «el año» y tumba el servicio en plena cena. 60 ya es un trimestre largo de
 * turnos; por encima, se pide acotar el rango.
 */
export async function GET(request: NextRequest) {
  const auth = await requireCashier(request);
  if (!auth) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const { from, to } = resolveDateRange(sp);

  const sessions = await prisma.cashSession.findMany({
    where: { tenantId: TENANT, status: "CLOSED", closedAt: { gte: from, lte: to } },
    select: { id: true, folio: true, closedAt: true },
    orderBy: { closedAt: "desc" },
  });

  if (sessions.length > 60) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Rango demasiado amplio: máximo 60 cortes" }, { status: 400 });
  }

  // Tandas de 5: cada buildTipsForSession dispara varias consultas, y la caja
  // tiene DOS núcleos que además sirven las tablets en plena cena. El rango
  // habitual —«este mes» ≈ 50 cortes— roza el techo de 60, así que lanzarlas
  // todas de golpe (hasta ~240 consultas) no se hace. El orden se preserva
  // (closedAt desc): los trozos van en orden y reports[i] ↔ sessions[i].
  const BATCH = 5;
  const reports: Awaited<ReturnType<typeof buildTipsForSession>>[] = [];
  for (let i = 0; i < sessions.length; i += BATCH) {
    const done = await Promise.all(sessions.slice(i, i + BATCH).map((s) => buildTipsForSession(s.id)));
    reports.push(...done);
  }
  const porCorte = reports.map((r, i) => ({
    ...r,
    folio: sessions[i].folio,
    closedAt: sessions[i].closedAt ? sessions[i].closedAt!.toISOString() : null,
  }));
  const total = aggregateTipsRange(reports);

  return NextResponse.json<ApiResponse>({ success: true, data: { total, porCorte } });
}
