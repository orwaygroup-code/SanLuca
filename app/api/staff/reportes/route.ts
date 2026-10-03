import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TENANT } from "@/lib/comanda";
import { requireCashier } from "@/lib/dualAuth";
import { buildReportData } from "@/lib/reportsData";
import { resolveDateRange } from "@/lib/dateRange";
import { getOpenSession } from "@/lib/caja";
import type { ApiResponse } from "@/types";

/**
 * GET /api/staff/reportes?from=&to= — datos de la pantalla de Reportes de
 * Operación (la pantalla es R-2). Reutiliza `buildReportData` con los MISMOS
 * searchParams que /admin/reportes, para que el rango se resuelva idéntico, y le
 * añade la lista de cortes del RANGO (buildReportData solo da los de un día).
 *
 * Guard `requireCashier`: admite ADMIN (sl_session) u OPERATION/CAPTAIN/MANAGER
 * (sl_staff) y excluye a WAITER. Es el mismo guard de la Caja embebida, para que el
 * manager vea esto DENTRO del panel (/admin/reportes/operacion) con correo/contraseña,
 * sin PIN. Detalle de requireCashier: exige `staffId != null`, así que un ADMIN SIN
 * Staff vinculado recibe 403 (Ricardo/Cristian/Francesca/Paul lo tienen).
 *
 * Solo turnos CERRADOS en la lista de cortes: un turno abierto no tiene cifras
 * finales y meterlo en una suma histórica siembra un descuadre. Si el turno
 * abierto cae dentro del rango, se excluye y la respuesta lleva `turnoAbierto:
 * true` para que R-2 lo diga en pantalla.
 */
export async function GET(request: NextRequest) {
  const auth = await requireCashier(request);
  if (!auth) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const { data } = await buildReportData(sp);
  const { from, to } = resolveDateRange(sp);

  // Cortes del RANGO (no de un día): CashSession cerradas con closedAt dentro del
  // rango, más reciente primero. Sustituye a nivel top el `cortes` de un solo día
  // que trae `data` — es intencional: R-2 es una pantalla de rango.
  const sessions = await prisma.cashSession.findMany({
    where: { tenantId: TENANT, status: "CLOSED", closedAt: { gte: from, lte: to } },
    select: {
      id: true,
      folio: true,
      openedAt: true,
      closedAt: true,
      openedBy: { select: { fullName: true } },
      closedBy: { select: { fullName: true } },
      _count: { select: { comandas: true } },
      payments: { where: { voided: false }, select: { amount: true, tip: true } },
    },
    orderBy: { closedAt: "desc" },
  });

  const round = (n: number) => Math.round(n * 100) / 100;
  const cortes = sessions.map((s) => ({
    id: s.id,
    folio: s.folio,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt ? s.closedAt.toISOString() : null,
    openedBy: s.openedBy?.fullName ?? null,
    closedBy: s.closedBy?.fullName ?? null,
    comandas: s._count.comandas,
    sales: round(s.payments.reduce((sum, p) => sum + Number(p.amount), 0)),
    tips: round(s.payments.reduce((sum, p) => sum + Number(p.tip), 0)),
  }));

  // Un turno abierto no entra en los cortes; solo se marca su existencia en rango.
  const open = await getOpenSession();
  const turnoAbierto = !!open && open.openedAt >= from && open.openedAt <= to;

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { ...data, cortes, turnoAbierto },
  });
}
