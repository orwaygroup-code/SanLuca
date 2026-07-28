import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES } from "@/lib/comanda";
import { round2 } from "@/lib/comandaTotals";
import { getOpenSession } from "@/lib/caja";
import { loadWaiterBase, normalizePolicy, computeWaiterSettlement, distributePool } from "@/lib/tips";
import type { ApiResponse } from "@/types";

/**
 * GET /api/caja/tips/current — liquidación de propinas del turno ABIERTO (v2).
 * Por cada mesero con ventas: su venta (en vivo), su reserva digital (tarjeta+
 * transfer), su punto (7%), el neto y la dirección (PAY/COLLECT/EVEN), si ya está
 * liquidado, y si aún tiene cuentas activas (no se puede liquidar). Devuelve el
 * pool (Σ puntos) repartido a las áreas (política de Ajustes, solo lectura para
 * Perla) y `allSettled` (si el corte ya se puede hacer). requireCashier.
 */
export async function GET(request: NextRequest) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });

  const session = await getOpenSession();
  if (!session) return NextResponse.json<ApiResponse>({ success: true, data: { session: null } });

  const [base, settledRows, activeWaiters, settings] = await Promise.all([
    loadWaiterBase(session.id),
    prisma.waiterTipSettlement.findMany({
      where: { cashSessionId: session.id },
      include: { settledBy: { select: { fullName: true } } },
    }),
    prisma.comanda.findMany({
      where: { tenantId: TENANT, status: { in: [...ACTIVE_STATUSES] } },
      select: { waiterId: true },
      distinct: ["waiterId"],
    }),
    prisma.restaurantSettings.findUnique({ where: { tenantId: TENANT }, select: { tipPolicy: true } }),
  ]);

  const policy = normalizePolicy(settings?.tipPolicy);
  const settledMap = new Map(settledRows.map((r) => [r.waiterId, r]));
  const activeSet = new Set(activeWaiters.map((c) => c.waiterId));

  const waiters = base.map((w) => {
    const calc = computeWaiterSettlement(w.salesTotal, policy.pointPercent, w.reserveDigital);
    const s = settledMap.get(w.waiterId);
    return {
      waiterId: w.waiterId,
      fullName: w.fullName,
      salesTotal: w.salesTotal,
      reserveDigital: w.reserveDigital,
      tipsRegistered: w.tipsRegistered,
      deduction: calc.deduction,
      net: calc.net,
      direction: calc.direction,
      amount: calc.amount,
      hasActive: activeSet.has(w.waiterId),
      settled: s
        ? {
            direction: s.direction,
            amount: Number(s.amount),
            net: Number(s.net),
            deduction: Number(s.deduction),
            reserveCard: Number(s.reserveCard),
            salesTotal: Number(s.salesTotal),
            cashReceived: s.cashReceived != null ? Number(s.cashReceived) : null,
            changeGiven: Number(s.changeGiven),
            createdAt: s.createdAt,
            settledBy: s.settledBy?.fullName ?? null,
          }
        : null,
    };
  });

  const pool = round2(waiters.reduce((sum, w) => sum + w.deduction, 0));
  const areas = distributePool(pool, policy.areas);
  const allSettled = waiters.length > 0 && waiters.every((w) => w.settled);
  const pendingSettle = waiters.filter((w) => !w.settled).length;

  return NextResponse.json<ApiResponse>({
    success: true,
    data: { session, policy, pointPercent: policy.pointPercent, waiters, pool, areas, allSettled, pendingSettle },
  });
}
