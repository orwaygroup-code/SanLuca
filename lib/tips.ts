import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { TENANT } from "./comanda";
import { round2 } from "./comandaTotals";

type Db = typeof prisma | Prisma.TransactionClient;

/**
 * Reparto de propinas / "puntos" (Fase Propinas). Las propinas viven APARTE de
 * la caja. Por turno: cada mesero acumula ventas + propinas; se le descuenta un
 * "punto" (% sobre su venta) que se junta en un pool y se reparte a áreas
 * (barra/cocina/garroteros/encargados/caja). El punto = suma de los % de área.
 * Toda la matemática es pura y testeable; el saldo neto puede ser negativo.
 */

export interface TipArea { name: string; percent: number }
export interface WaiterBase { waiterId: number; fullName: string; salesTotal: number; tipsRegistered: number }

export const DEFAULT_TIP_AREAS: TipArea[] = [
  { name: "Barra", percent: 2 },
  { name: "Cocina", percent: 2.5 },
  { name: "Garroteros", percent: 1 },
  { name: "Encargados", percent: 1 },
  { name: "Caja", percent: 0.5 },
];

/** El "punto" total = suma de los % de las áreas. */
export function sumAreaPercents(areas: TipArea[]): number {
  return round2(areas.reduce((s, a) => s + (Number(a.percent) || 0), 0));
}

/** Descuento de puntos de un mesero: % del punto sobre su venta total. */
export function computeDeduction(salesTotal: number, pointPercent: number): number {
  return round2((salesTotal * pointPercent) / 100);
}

/** Neto del mesero: propinas (registradas + efectivo declarado) − descuento. Puede ser negativo. */
export function computeNetTip(tipsRegistered: number, cashTipsDeclared: number, deduction: number): number {
  return round2(tipsRegistered + cashTipsDeclared - deduction);
}

/** Reparte a áreas: cada área recibe % sobre la venta total del turno. */
export function distributeToAreas(salesTotal: number, areas: TipArea[]): { name: string; percent: number; amount: number }[] {
  return areas.map((a) => ({ name: a.name, percent: round2(Number(a.percent) || 0), amount: round2((salesTotal * (Number(a.percent) || 0)) / 100) }));
}

/** Normaliza la política guardada (JSON) o cae al default. */
export function normalizeAreas(raw: unknown): TipArea[] {
  const arr = (raw as { areas?: unknown })?.areas;
  if (!Array.isArray(arr)) return DEFAULT_TIP_AREAS;
  const areas = arr
    .filter((a): a is { name: unknown; percent: unknown } => !!a && typeof a === "object")
    .map((a) => ({ name: String((a as { name: unknown }).name ?? "").trim(), percent: round2(Number((a as { percent: unknown }).percent) || 0) }))
    .filter((a) => a.name && a.percent >= 0);
  return areas.length ? areas : DEFAULT_TIP_AREAS;
}

/**
 * Base por mesero para un turno: ventas (comandas PAID del turno) + propinas
 * registradas (Σ propina de pagos no anulados). El efectivo declarado se agrega
 * después en el reparto. Ordenado por venta desc.
 */
export async function loadWaiterBase(cashSessionId: number, db: Db = prisma): Promise<WaiterBase[]> {
  const comandas = await db.comanda.findMany({
    where: { tenantId: TENANT, cashSessionId, status: "PAID" },
    select: {
      waiterId: true,
      total: true,
      waiter: { select: { fullName: true } },
      payments: { where: { voided: false }, select: { tip: true } },
    },
  });
  const map = new Map<number, WaiterBase>();
  for (const c of comandas) {
    const cur = map.get(c.waiterId) ?? { waiterId: c.waiterId, fullName: c.waiter.fullName, salesTotal: 0, tipsRegistered: 0 };
    cur.salesTotal = round2(cur.salesTotal + Number(c.total));
    cur.tipsRegistered = round2(cur.tipsRegistered + c.payments.reduce((s, p) => s + Number(p.tip), 0));
    map.set(c.waiterId, cur);
  }
  return [...map.values()].sort((a, b) => b.salesTotal - a.salesTotal);
}
