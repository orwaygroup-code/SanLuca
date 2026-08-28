import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

const MX_TZ = "America/Mexico_City";
const DAY = 86_400_000;
function mxToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MX_TZ }).format(new Date());
}
const round = (n: number) => Math.round(n * 100) / 100;

interface Agg {
  waiterId: number; name: string;
  sales: number; comandas: number; guests: number; items: number; tips: number;
  dishes: Map<string, number>;
}

/**
 * GET /api/admin/meseros?range=today|7d|30d — desempeño por mesero (SOLO VISUALIZACIÓN).
 * Solo ADMIN. Base: comandas PAID en el rango. Por mesero: ventas, cuentas, comensales,
 * ticket promedio, gasto por persona, propinas, % del total y platillo más vendido.
 * Ordenado por ventas desc. También activas-ahora por mesero.
 */
export async function GET(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const range = sp.get("range") ?? "today";
  const days = range === "30d" ? 30 : range === "7d" ? 7 : 1;
  const todayStart = new Date(`${mxToday()}T00:00:00.000-06:00`);
  const from = new Date(todayStart.getTime() - (days - 1) * DAY);
  const now = new Date();

  const paid = await prisma.comanda.findMany({
    where: { tenantId: TENANT, status: "PAID", closedAt: { gte: from, lte: now } },
    select: {
      total: true, guestsActual: true,
      waiterId: true, waiter: { select: { fullName: true } },
      items: { where: { status: { not: "CANCELLED" } }, select: { dishNameSnapshot: true, quantity: true } },
      payments: { where: { voided: false }, select: { tip: true } },
    },
  });

  const byWaiter = new Map<number, Agg>();
  for (const c of paid) {
    const g = byWaiter.get(c.waiterId) ?? { waiterId: c.waiterId, name: c.waiter?.fullName ?? "—", sales: 0, comandas: 0, guests: 0, items: 0, tips: 0, dishes: new Map<string, number>() };
    g.sales += Number(c.total);
    g.comandas += 1;
    g.guests += c.guestsActual;
    g.tips += c.payments.reduce((s, p) => s + Number(p.tip), 0);
    for (const it of c.items) { g.items += Number(it.quantity); g.dishes.set(it.dishNameSnapshot, (g.dishes.get(it.dishNameSnapshot) ?? 0) + Number(it.quantity)); }
    byWaiter.set(c.waiterId, g);
  }

  // Cuentas activas ahora por mesero (para contexto "está en piso").
  const active = await prisma.comanda.groupBy({
    by: ["waiterId"],
    where: { tenantId: TENANT, status: { in: [...ACTIVE_STATUSES] } },
    _count: { _all: true },
  });
  const activeByWaiter = new Map<number, number>(active.map((r) => [r.waiterId, r._count._all]));

  const totalSales = round([...byWaiter.values()].reduce((s, g) => s + g.sales, 0));

  const waiters = [...byWaiter.values()]
    .map((g) => {
      const top = [...g.dishes.entries()].sort((x, y) => y[1] - x[1])[0];
      return {
        waiterId: g.waiterId, name: g.name,
        sales: round(g.sales), comandas: g.comandas, guests: g.guests, items: round(g.items), tips: round(g.tips),
        avgTicket: g.comandas ? round(g.sales / g.comandas) : 0,
        avgPerGuest: g.guests ? round(g.sales / g.guests) : 0,
        sharePct: totalSales ? Math.round((g.sales / totalSales) * 100) : 0,
        activeNow: activeByWaiter.get(g.waiterId) ?? 0,
        topDish: top ? { name: top[0], qty: top[1] } : null,
      };
    })
    .sort((x, y) => y.sales - x.sales);

  const totals = {
    sales: totalSales,
    comandas: waiters.reduce((s, w) => s + w.comandas, 0),
    guests: waiters.reduce((s, w) => s + w.guests, 0),
    tips: round(waiters.reduce((s, w) => s + w.tips, 0)),
  };

  return NextResponse.json<ApiResponse>({ success: true, data: { range, from: from.toISOString(), to: now.toISOString(), totals, waiters } });
}
