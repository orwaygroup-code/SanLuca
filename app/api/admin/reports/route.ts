import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

const MX_TZ = "America/Mexico_City";
const DAY = 86_400_000;

function mxToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MX_TZ }).format(new Date()); // YYYY-MM-DD
}
function mxHour(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: MX_TZ, hour: "2-digit", hour12: false }).format(d)) % 24;
}

/**
 * GET /api/admin/reports?range=today|7d|30d — agregados de ventas para el
 * dashboard POS de Ricardo. Solo ADMIN (sl_session). Calcula sobre comandas
 * PAID con closedAt dentro del rango (MX timezone). Montos en number.
 */
export async function GET(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const range = new URL(request.url).searchParams.get("range") ?? "today";
  const days = range === "30d" ? 30 : range === "7d" ? 7 : 1;

  const today = mxToday();
  const todayStart = new Date(`${today}T00:00:00.000-06:00`);
  const from = new Date(todayStart.getTime() - (days - 1) * DAY);
  const now = new Date();

  const paid = await prisma.comanda.findMany({
    where: { tenantId: TENANT, status: "PAID", closedAt: { gte: from, lte: now } },
    select: {
      id: true, total: true, taxAmount: true, guestsActual: true, closedAt: true,
      table: { select: { section: { select: { name: true } } } },
      waiter: { select: { fullName: true } },
      items: { where: { status: { not: "CANCELLED" } }, select: { dishNameSnapshot: true, quantity: true, lineTotal: true } },
    },
  });

  const activeNow = await prisma.comanda.count({
    where: { tenantId: TENANT, status: { in: [...ACTIVE_STATUSES] } },
  });

  // Desglose por método de pago + propinas (pagos NO anulados dentro del rango).
  const payGroups = await prisma.comandaPayment.groupBy({
    by: ["method"],
    where: { tenantId: TENANT, voided: false, createdAt: { gte: from, lte: now } },
    _sum: { amount: true, tip: true },
    _count: { _all: true },
  });

  let sales = 0, taxCollected = 0, guests = 0;
  const byHour = new Map<number, number>();
  const bySection = new Map<string, { sales: number; comandas: number }>();
  const byWaiter = new Map<string, { sales: number; comandas: number }>();
  const dishes = new Map<string, { qty: number; revenue: number }>();

  for (const c of paid) {
    const total = Number(c.total);
    sales += total;
    taxCollected += Number(c.taxAmount);
    guests += c.guestsActual;

    if (c.closedAt) {
      const h = mxHour(c.closedAt);
      byHour.set(h, (byHour.get(h) ?? 0) + total);
    }
    const sec = c.table?.section?.name ?? "—";
    const s = bySection.get(sec) ?? { sales: 0, comandas: 0 };
    s.sales += total; s.comandas += 1; bySection.set(sec, s);

    const w = c.waiter?.fullName ?? "—";
    const wv = byWaiter.get(w) ?? { sales: 0, comandas: 0 };
    wv.sales += total; wv.comandas += 1; byWaiter.set(w, wv);

    for (const it of c.items) {
      const d = dishes.get(it.dishNameSnapshot) ?? { qty: 0, revenue: 0 };
      d.qty += it.quantity; d.revenue += Number(it.lineTotal); dishes.set(it.dishNameSnapshot, d);
    }
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const comandas = paid.length;

  const byMethod = payGroups.map((g) => ({
    method: g.method,
    amount: round(Number(g._sum.amount ?? 0)),
    tip: round(Number(g._sum.tip ?? 0)),
    count: g._count._all,
  })).sort((a, b) => b.amount - a.amount);
  const tips = round(byMethod.reduce((s, m) => s + m.tip, 0));

  const data = {
    range, from: from.toISOString(), to: now.toISOString(),
    kpis: {
      sales: round(sales),
      taxCollected: round(taxCollected),
      tips,
      comandas,
      guests,
      avgTicket: comandas ? round(sales / comandas) : 0,
      activeNow,
    },
    byMethod,
    byHour: Array.from(byHour.entries()).sort((a, b) => a[0] - b[0]).map(([hour, s]) => ({ hour, sales: round(s) })),
    bySection: Array.from(bySection.entries()).map(([section, v]) => ({ section, sales: round(v.sales), comandas: v.comandas })).sort((a, b) => b.sales - a.sales),
    byWaiter: Array.from(byWaiter.entries()).map(([waiter, v]) => ({ waiter, sales: round(v.sales), comandas: v.comandas })).sort((a, b) => b.sales - a.sales),
    topDishes: Array.from(dishes.entries()).map(([name, v]) => ({ name, qty: v.qty, revenue: round(v.revenue) })).sort((a, b) => b.qty - a.qty).slice(0, 10),
  };

  return NextResponse.json<ApiResponse>({ success: true, data });
}
