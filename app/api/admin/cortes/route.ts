import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import { resolveDateRange } from "@/lib/dateRange";
import type { ApiResponse } from "@/types";

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * GET /api/admin/cortes?range|from|to — HISTÓRICO de cierres de turno (CashSessions),
 * por fecha de apertura. Solo lectura. ADMIN. Cada corte = un turno de caja.
 */
export async function GET(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const { from, to, label } = resolveDateRange(sp);

  const sessions = await prisma.cashSession.findMany({
    where: { tenantId: TENANT, openedAt: { gte: from, lte: to } },
    select: {
      id: true, folio: true, shift: true, status: true, openedAt: true, closedAt: true,
      openingFloat: true, expectedCash: true, countedCash: true, countedCard: true, difference: true,
      openedBy: { select: { fullName: true } },
      closedBy: { select: { fullName: true } },
      _count: { select: { comandas: true } },
      payments: { where: { voided: false }, select: { amount: true, tip: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  const rows = sessions.map((s) => ({
    id: s.id, folio: s.folio, shift: s.shift, status: s.status,
    openedAt: s.openedAt.toISOString(), closedAt: s.closedAt ? s.closedAt.toISOString() : null,
    openedBy: s.openedBy?.fullName ?? "—",
    closedBy: s.closedBy?.fullName ?? null,
    openingFloat: round(Number(s.openingFloat)),
    expectedCash: s.expectedCash != null ? round(Number(s.expectedCash)) : null,
    countedCash: s.countedCash != null ? round(Number(s.countedCash)) : null,
    countedCard: s.countedCard != null ? round(Number(s.countedCard)) : null,
    difference: s.difference != null ? round(Number(s.difference)) : null,
    comandas: s._count.comandas,
    sales: round(s.payments.reduce((sum, p) => sum + Number(p.amount), 0)),
    tips: round(s.payments.reduce((sum, p) => sum + Number(p.tip), 0)),
  }));

  const salesTotal = round(rows.reduce((s, r) => s + r.sales, 0));
  return NextResponse.json<ApiResponse>({ success: true, data: { rows, salesTotal, count: rows.length, label } });
}
