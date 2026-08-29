import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES } from "@/lib/comanda";
import { resolveDateRange } from "@/lib/dateRange";
import type { ApiResponse } from "@/types";

const MX_TZ = "America/Mexico_City";
const DAY = 86_400_000;

function mxToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MX_TZ }).format(new Date()); // YYYY-MM-DD
}
function mxHour(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: MX_TZ, hour: "2-digit", hour12: false }).format(d)) % 24;
}

// El campo Comanda.shift guarda "brunch" | "cena". En la UI: Brunch y Comida.
const SHIFT_META: Record<string, { label: string; window: string }> = {
  cena:   { label: "Comida", window: "14:00 – cierre" },
  brunch: { label: "Brunch", window: "08:00 – 14:00" },
};
const shiftKey = (s: string | null) => (s === "brunch" ? "brunch" : s === "cena" ? "cena" : "otro");

/**
 * GET /api/admin/reports?range=today|7d|30d[&cashSessionId=N] — agregados de ventas
 * para el dashboard del manager. Solo ADMIN (sl_session). Base: comandas PAID.
 * - Con cashSessionId: acota TODO a ese corte de caja (turno por corte).
 * - Sin él: por rango de closedAt (MX timezone).
 * Devuelve además byShift (Comida vs Brunch) y cortes (CashSessions de hoy).
 */
export async function GET(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const cashSessionId = sp.get("cashSessionId") ? Number(sp.get("cashSessionId")) : null;
  const { from, to, label: range } = resolveDateRange(sp);
  const today = mxToday();
  const now = to;

  // El corte (cashSessionId) tiene prioridad sobre el rango.
  const paidWhere = cashSessionId
    ? { tenantId: TENANT, status: "PAID" as const, cashSessionId }
    : { tenantId: TENANT, status: "PAID" as const, closedAt: { gte: from, lte: now } };

  const paid = await prisma.comanda.findMany({
    where: paidWhere,
    select: {
      id: true, total: true, taxAmount: true, guestsActual: true, closedAt: true, shift: true, tableId: true,
      table: { select: { section: { select: { name: true } } } },
      waiter: { select: { fullName: true } },
      items: { where: { status: { not: "CANCELLED" } }, select: {
        dishNameSnapshot: true, quantity: true, lineTotal: true,
        dish: { select: { category: { select: { carta: { select: { name: true, turno: true } } } } } },
      } },
    },
  });

  const activeNow = await prisma.comanda.count({ where: { tenantId: TENANT, status: { in: [...ACTIVE_STATUSES] } } });
  const totalTables = await prisma.table.count({ where: { isActive: true } });

  const payGroups = await prisma.comandaPayment.groupBy({
    by: ["method"],
    where: cashSessionId
      ? { tenantId: TENANT, voided: false, cashSessionId }
      : { tenantId: TENANT, voided: false, createdAt: { gte: from, lte: now } },
    _sum: { amount: true, tip: true },
    _count: { _all: true },
  });

  let sales = 0, taxCollected = 0, guests = 0;
  const byHour = new Map<number, number>();
  const bySection = new Map<string, { sales: number; comandas: number }>();
  const byWaiter = new Map<string, { sales: number; comandas: number }>();
  const dishes = new Map<string, { qty: number; revenue: number; comandas: Set<number> }>();
  // Por menú (carta) con desglose de sus platillos y en cuántas comandas apareció cada uno.
  const cartas = new Map<string, { qty: number; revenue: number; comandas: Set<number>; dishes: Map<string, { qty: number; revenue: number; comandas: Set<number> }> }>();
  const shifts = new Map<string, { sales: number; comandas: number; guests: number; tables: Set<string>; dishes: Map<string, number> }>();

  for (const c of paid) {
    const total = Number(c.total);
    sales += total;
    taxCollected += Number(c.taxAmount);
    guests += c.guestsActual;

    if (c.closedAt) { const h = mxHour(c.closedAt); byHour.set(h, (byHour.get(h) ?? 0) + total); }
    const sec = c.table?.section?.name ?? "—";
    const s = bySection.get(sec) ?? { sales: 0, comandas: 0 }; s.sales += total; s.comandas += 1; bySection.set(sec, s);
    const w = c.waiter?.fullName ?? "—";
    const wv = byWaiter.get(w) ?? { sales: 0, comandas: 0 }; wv.sales += total; wv.comandas += 1; byWaiter.set(w, wv);
    for (const it of c.items) {
      const q = Number(it.quantity), lt = Number(it.lineTotal), nm = it.dishNameSnapshot;
      const d = dishes.get(nm) ?? { qty: 0, revenue: 0, comandas: new Set<number>() };
      d.qty += q; d.revenue += lt; d.comandas.add(c.id); dishes.set(nm, d);
      const cartaName = it.dish?.category?.carta?.name ?? "Sin carta / extras";
      const cv = cartas.get(cartaName) ?? { qty: 0, revenue: 0, comandas: new Set<number>(), dishes: new Map() };
      cv.qty += q; cv.revenue += lt; cv.comandas.add(c.id);
      const cd = cv.dishes.get(nm) ?? { qty: 0, revenue: 0, comandas: new Set<number>() };
      cd.qty += q; cd.revenue += lt; cd.comandas.add(c.id); cv.dishes.set(nm, cd);
      cartas.set(cartaName, cv);
    }

    const sk = shiftKey(c.shift);
    const sh = shifts.get(sk) ?? { sales: 0, comandas: 0, guests: 0, tables: new Set<string>(), dishes: new Map<string, number>() };
    sh.sales += total; sh.comandas += 1; sh.guests += c.guestsActual;
    if (c.tableId) sh.tables.add(c.tableId);
    for (const it of c.items) sh.dishes.set(it.dishNameSnapshot, (sh.dishes.get(it.dishNameSnapshot) ?? 0) + Number(it.quantity));
    shifts.set(sk, sh);
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const comandas = paid.length;

  const byMethod = payGroups.map((g) => ({
    method: g.method, amount: round(Number(g._sum.amount ?? 0)), tip: round(Number(g._sum.tip ?? 0)), count: g._count._all,
  })).sort((a, b) => b.amount - a.amount);
  const tips = round(byMethod.reduce((s, m) => s + m.tip, 0));

  const byShift = (["cena", "brunch"] as const).map((sk) => {
    const sh = shifts.get(sk);
    const meta = SHIFT_META[sk];
    const topDish = sh ? [...sh.dishes.entries()].sort((a, b) => b[1] - a[1])[0] : undefined;
    return {
      shift: sk, label: meta.label, window: meta.window,
      sales: round(sh?.sales ?? 0), comandas: sh?.comandas ?? 0, guests: sh?.guests ?? 0,
      avgTicket: sh && sh.comandas ? round(sh.sales / sh.comandas) : 0,
      occupancy: totalTables ? Math.round(((sh?.tables.size ?? 0) / totalTables) * 100) : 0,
      topDish: topDish ? { name: topDish[0], qty: topDish[1] } : null,
    };
  });

  // Cortes (CashSessions) del día pedido (default HOY) — cada uno es un "turno por corte".
  // cortesDate permite ver e imprimir cortes de días pasados (histórico).
  const cortesDateStr = sp.get("cortesDate") || today;
  const cortesStart = new Date(`${cortesDateStr}T00:00:00.000-06:00`);
  const cortesEnd = new Date(cortesStart.getTime() + DAY);
  const sessions = await prisma.cashSession.findMany({
    where: { tenantId: TENANT, openedAt: { gte: cortesStart, lt: cortesEnd } },
    select: {
      id: true, folio: true, shift: true, status: true, openedAt: true, closedAt: true,
      _count: { select: { comandas: true } },
      payments: { where: { voided: false }, select: { amount: true } },
    },
    orderBy: { openedAt: "asc" },
  });
  const cortes = sessions.map((s) => ({
    id: s.id, folio: s.folio, shift: s.shift, status: s.status,
    openedAt: s.openedAt.toISOString(), closedAt: s.closedAt ? s.closedAt.toISOString() : null,
    comandas: s._count.comandas,
    sales: round(s.payments.reduce((sum, p) => sum + Number(p.amount), 0)),
  }));

  const data = {
    range, cashSessionId, cortesDate: cortesDateStr, from: from.toISOString(), to: now.toISOString(),
    kpis: { sales: round(sales), taxCollected: round(taxCollected), tips, comandas, guests, avgTicket: comandas ? round(sales / comandas) : 0, activeNow },
    byMethod,
    byShift,
    cortes,
    byHour: Array.from(byHour.entries()).sort((a, b) => a[0] - b[0]).map(([hour, s]) => ({ hour, sales: round(s) })),
    bySection: Array.from(bySection.entries()).map(([section, v]) => ({ section, sales: round(v.sales), comandas: v.comandas })).sort((a, b) => b.sales - a.sales),
    byWaiter: Array.from(byWaiter.entries()).map(([waiter, v]) => ({ waiter, sales: round(v.sales), comandas: v.comandas })).sort((a, b) => b.sales - a.sales),
    topDishes: Array.from(dishes.entries()).map(([name, v]) => ({ name, qty: v.qty, revenue: round(v.revenue), comandas: v.comandas.size })).sort((a, b) => b.qty - a.qty).slice(0, 100),
    byCarta: Array.from(cartas.entries()).map(([carta, v]) => ({
      carta, qty: v.qty, revenue: round(v.revenue), comandas: v.comandas.size,
      dishes: Array.from(v.dishes.entries()).map(([name, d]) => ({ name, qty: d.qty, revenue: round(d.revenue), comandas: d.comandas.size })).sort((a, b) => b.qty - a.qty),
    })).sort((a, b) => b.revenue - a.revenue),
  };

  return NextResponse.json<ApiResponse>({ success: true, data });
}
