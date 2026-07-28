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

export interface TipArea { name: string; percent: number } // "percent" = peso relativo de reparto del pool
export interface TipPolicy { pointPercent: number; areas: TipArea[] } // punto (% de venta) + reparto a áreas
export interface WaiterBase { waiterId: number; fullName: string; salesTotal: number; tipsRegistered: number }

/** Punto default: 7% sobre la venta total del mesero. */
export const DEFAULT_POINT_PERCENT = 7;
export const DEFAULT_TIP_AREAS: TipArea[] = [
  { name: "Barra", percent: 2 },
  { name: "Cocina", percent: 2.5 },
  { name: "Garroteros", percent: 1 },
  { name: "Encargados", percent: 1 },
  { name: "Caja", percent: 0.5 },
];
export const DEFAULT_TIP_POLICY: TipPolicy = { pointPercent: DEFAULT_POINT_PERCENT, areas: DEFAULT_TIP_AREAS };

export function sumAreaPercents(areas: TipArea[]): number {
  return round2(areas.reduce((s, a) => s + (Number(a.percent) || 0), 0));
}

/** Descuento de puntos de un mesero: punto% sobre su venta total. */
export function computeDeduction(salesTotal: number, pointPercent: number): number {
  return round2((salesTotal * pointPercent) / 100);
}

/** Neto del mesero: propinas (registradas + efectivo declarado) − descuento. Puede ser negativo. */
export function computeNetTip(tipsRegistered: number, cashTipsDeclared: number, deduction: number): number {
  return round2(tipsRegistered + cashTipsDeclared - deduction);
}

/**
 * Reparte el POOL entre áreas por su peso relativo (proporcional). Siempre
 * reparte el 100% del pool sin importar cuánto sumen los pesos. Con los pesos
 * default (2/2.5/1/1/0.5 = 7) y punto 7%, cada área recibe su "% de venta".
 */
export function distributePool(poolTotal: number, areas: TipArea[]): { name: string; percent: number; amount: number }[] {
  const totalW = areas.reduce((s, a) => s + Math.max(0, Number(a.percent) || 0), 0);
  return areas.map((a) => {
    const w = Math.max(0, Number(a.percent) || 0);
    return { name: a.name, percent: round2(w), amount: totalW > 0 ? round2((poolTotal * w) / totalW) : 0 };
  });
}

function normalizeAreas(arr: unknown): TipArea[] {
  if (!Array.isArray(arr)) return DEFAULT_TIP_AREAS;
  const areas = arr
    .filter((a): a is { name: unknown; percent: unknown } => !!a && typeof a === "object")
    .map((a) => ({ name: String((a as { name: unknown }).name ?? "").trim(), percent: round2(Number((a as { percent: unknown }).percent) || 0) }))
    .filter((a) => a.name && a.percent >= 0);
  return areas.length ? areas : DEFAULT_TIP_AREAS;
}

/** Normaliza la política guardada (JSON { pointPercent, areas }) o cae al default. */
export function normalizePolicy(raw: unknown): TipPolicy {
  const o = (raw ?? {}) as { pointPercent?: unknown; areas?: unknown };
  const pp = Number(o.pointPercent);
  return {
    pointPercent: Number.isFinite(pp) && pp >= 0 ? round2(pp) : DEFAULT_POINT_PERCENT,
    areas: normalizeAreas(o.areas),
  };
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
