import { prisma } from "./prisma";
import { TENANT } from "./comanda";
import { round2 } from "./comandaTotals";
import {
  loadWaiterBase,
  normalizePolicy,
  computeWaiterSettlement,
  distributePool,
  type TipDirection,
} from "./tips";

/**
 * Reporte de propinas de un turno CERRADO (y, de paso, reutilizable para el
 * turno abierto desde reportes históricos). Ola R-1.
 *
 * REGLA QUE LO GOBIERNA: para un turno cerrado, la verdad son las liquidaciones,
 * no un recálculo. `WaiterTipSettlement` guarda, por mesero y turno, la FOTO de
 * la póliza al liquidar (`pointPercent`), la venta, la reserva, el neto y la
 * dirección. Si mañana cambias el punto del 7% al 8% y el reporte recalculara,
 * la historia cambiaría sola y el corte de hace un mes mostraría cifras que
 * nadie pagó. Entonces, por cada mesero del turno:
 *   - con `WaiterTipSettlement` → los números salen de ahí, tal cual, `estimado: false`.
 *   - sin ella (turno cerrado sin liquidar, o turno abierto) → se calcula con
 *     `computeWaiterSettlement` y la póliza VIGENTE, y se marca `estimado: true`.
 * Un número estimado y uno histórico no se mezclan en silencio: la respuesta
 * lleva la cuenta (`estimados`).
 *
 * LIMITACIÓN DECLARADA: `WaiterTipSettlement` NO guarda foto de las ÁREAS, solo
 * del `pointPercent`. Por eso el reparto por área de un pool pasado se calcula
 * SIEMPRE con las áreas vigentes. Es una limitación real, no un descuido: se
 * expone como `areasPolicyIsCurrent: true` para que la pantalla (R-2) pueda
 * avisarlo. No se inventa un snapshot de áreas ni se toca el schema para
 * arreglarlo: eso es otra decisión y otra ola.
 *
 * Por qué `buildTipsForSession` NO alimenta el top-level de /api/caja/tips/current:
 * esa pantalla, en vivo, necesita el recálculo EN VIVO del mesero liquidado para
 * detectar «vendió más después de liquidar» (TipsPanel.tsx compara salesTotal en
 * vivo contra el snapshot). Aquí, en cambio, el snapshot ES la verdad. Son dos
 * usos distintos a propósito.
 */

export interface TipsWaiterRow {
  waiterId: number;
  fullName: string;
  salesTotal: number;
  tipsRegistered: number;
  reserveDigital: number;
  pointPercent: number;
  deduction: number;
  net: number;
  direction: TipDirection;
  amount: number;
  salesAfterSettle: number; // venta en vivo − venta del snapshot: lo que vendió DESPUÉS de liquidar y cuyo 7% nunca entró al pool.
  estimado: boolean;
  settledAt: string | null;
  settledBy: string | null;
}

export interface TipsSessionReport {
  cashSessionId: number;
  waiters: TipsWaiterRow[];
  pool: number; // Σ deduction  — el 7%
  tipsRegistered: number; // Σ propina de los meseros (SIN "llevar")
  tipsRegisteredAll: number; // Σ propina de TODOS los pagos del turno, "llevar" incluido
  sinElPunto: number; // tipsRegistered − pool (puede ser negativo: el signo es información)
  areas: { name: string; percent: number; amount: number }[];
  areasPolicyIsCurrent: true;
  estimados: number; // cuántos meseros sin liquidación
}

export async function buildTipsForSession(cashSessionId: number): Promise<TipsSessionReport> {
  const [base, settledRows, settings, allTips] = await Promise.all([
    loadWaiterBase(cashSessionId),
    prisma.waiterTipSettlement.findMany({
      where: { cashSessionId },
      include: { settledBy: { select: { fullName: true } } },
    }),
    prisma.restaurantSettings.findUnique({ where: { tenantId: TENANT }, select: { tipPolicy: true } }),
    // tipsRegisteredAll: Σ propina de TODOS los pagos no anulados del turno,
    // incluido el mesero de sistema "llevar" (que loadWaiterBase excluye). Existe
    // aparte de tipsRegistered porque VAN a ser distintas: si solo expusiéramos
    // una, el día que alguien la compare con el corte reportaría un error que no
    // existe.
    prisma.comandaPayment.aggregate({
      where: { tenantId: TENANT, cashSessionId, voided: false },
      _sum: { tip: true },
    }),
  ]);

  const policy = normalizePolicy(settings?.tipPolicy);
  const settledMap = new Map(settledRows.map((r) => [r.waiterId, r]));

  const waiters: TipsWaiterRow[] = base.map((w) => {
    const s = settledMap.get(w.waiterId);
    if (s) {
      // Turno/mesero liquidado: la verdad es la foto guardada, tal cual.
      return {
        waiterId: w.waiterId,
        fullName: w.fullName,
        salesTotal: Number(s.salesTotal),
        tipsRegistered: w.tipsRegistered, // el total registrado no se guarda en la liquidación; sale de la base del turno (frozen al cerrar).
        reserveDigital: Number(s.reserveCard),
        pointPercent: Number(s.pointPercent),
        deduction: Number(s.deduction),
        net: Number(s.net),
        direction: s.direction as TipDirection,
        amount: Number(s.amount),
        // Venta posterior a la liquidación: su 7% nunca entró al pool. Es la MISMA
        // comparación que hace TipsPanel para mostrar «Re-liquidar» en vivo, pero
        // mirada en histórico, para que la fuga se vea sin abrir la caja.
        salesAfterSettle: round2(Math.max(0, w.salesTotal - Number(s.salesTotal))),
        estimado: false,
        settledAt: s.createdAt.toISOString(),
        settledBy: s.settledBy?.fullName ?? null,
      };
    }
    // Sin liquidación: estimado con la póliza vigente.
    const calc = computeWaiterSettlement(w.salesTotal, policy.pointPercent, w.reserveDigital);
    return {
      waiterId: w.waiterId,
      fullName: w.fullName,
      salesTotal: w.salesTotal,
      tipsRegistered: w.tipsRegistered,
      reserveDigital: w.reserveDigital,
      pointPercent: policy.pointPercent,
      deduction: calc.deduction,
      net: calc.net,
      direction: calc.direction,
      amount: calc.amount,
      salesAfterSettle: 0, // sin liquidación no hay "después de liquidar" que medir.
      estimado: true,
      settledAt: null,
      settledBy: null,
    };
  });

  const pool = round2(waiters.reduce((sum, w) => sum + w.deduction, 0));
  const tipsRegistered = round2(waiters.reduce((sum, w) => sum + w.tipsRegistered, 0));
  const tipsRegisteredAll = round2(Number(allTips._sum.tip ?? 0));
  const sinElPunto = round2(tipsRegistered - pool); // puede ser negativo; el signo se conserva.
  const areas = distributePool(pool, policy.areas);
  const estimados = waiters.filter((w) => w.estimado).length;

  return {
    cashSessionId,
    waiters,
    pool,
    tipsRegistered,
    tipsRegisteredAll,
    sinElPunto,
    areas,
    areasPolicyIsCurrent: true,
    estimados,
  };
}

/**
 * Suma de varios turnos para una vista de rango. PURA (testeable sin base).
 * Agrupa las áreas POR NOMBRE: si la póliza cambió a mitad del rango pueden
 * venir nombres distintos entre turnos — se suman por nombre y aparecen TODOS,
 * no se descarta ninguno. Redondeo a 2 decimales al FINAL de cada suma, no en
 * cada paso (si no, los centavos arrastran).
 */
export function aggregateTipsRange(sessions: TipsSessionReport[]): {
  cortes: number;
  pool: number;
  tipsRegistered: number;
  tipsRegisteredAll: number;
  sinElPunto: number;
  estimados: number;
  salesAfterSettle: number; // Σ venta posterior a liquidar — 7% que se fugó del pool en el rango
  conVentaPosterior: number; // cuántos meseros (corte por corte) con salesAfterSettle > 0
  areas: { name: string; amount: number }[];
} {
  let pool = 0;
  let tipsRegistered = 0;
  let tipsRegisteredAll = 0;
  let sinElPunto = 0;
  let estimados = 0;
  let salesAfterSettle = 0;
  let conVentaPosterior = 0;
  const areaMap = new Map<string, number>();

  for (const s of sessions) {
    pool += s.pool;
    tipsRegistered += s.tipsRegistered;
    tipsRegisteredAll += s.tipsRegisteredAll;
    sinElPunto += s.sinElPunto;
    estimados += s.estimados;
    for (const w of s.waiters) {
      salesAfterSettle += w.salesAfterSettle;
      if (w.salesAfterSettle > 0) conVentaPosterior += 1;
    }
    for (const a of s.areas) areaMap.set(a.name, (areaMap.get(a.name) ?? 0) + a.amount);
  }

  return {
    cortes: sessions.length,
    pool: round2(pool),
    tipsRegistered: round2(tipsRegistered),
    tipsRegisteredAll: round2(tipsRegisteredAll),
    sinElPunto: round2(sinElPunto),
    estimados,
    salesAfterSettle: round2(salesAfterSettle),
    conVentaPosterior,
    areas: [...areaMap.entries()].map(([name, amount]) => ({ name, amount: round2(amount) })),
  };
}
