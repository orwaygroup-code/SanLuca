import type { Prisma, PaymentMethod } from "@prisma/client";
import { prisma } from "./prisma";
import { TENANT } from "./comanda";
import { round2 } from "./comandaTotals";
import { formatCashFolio } from "./comandaRules";

type Db = typeof prisma | Prisma.TransactionClient;

/**
 * Servicio de CAJA / POS (Fase Caja). Sesión de cajón, folios y corte.
 * Usa el cliente admin `prisma` (mismo realm que Comandas, sin RLS). Todo el
 * dinero se maneja en `number` acotado y se persiste como Decimal(10,2).
 */

export const CASH_SESSION_INCLUDE = {
  openedBy: { select: { id: true, fullName: true, username: true } },
  closedBy: { select: { id: true, fullName: true, username: true } },
} as const;

/** La sesión OPEN del tenant (a lo más una — se enforce en el endpoint). */
export function getOpenSession(db: Db = prisma) {
  return db.cashSession.findFirst({
    where: { tenantId: TENANT, status: "OPEN" },
    include: CASH_SESSION_INCLUDE,
  });
}

const MX_TZ = "America/Mexico_City";
export function mxYear(): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: MX_TZ, year: "numeric" }).format(new Date()));
}

/** Siguiente folio CAJA-AAAA-NNNN (secuencial por año). Reintento en el endpoint. */
export async function nextCashFolio(db: Db = prisma): Promise<string> {
  const year = mxYear();
  const seq =
    (await db.cashSession.count({ where: { tenantId: TENANT, folio: { startsWith: `CAJA-${year}-` } } })) + 1;
  return formatCashFolio(year, seq);
}

export interface CutMethodRow {
  method: PaymentMethod;
  count: number;
  amount: number; // Σ pagos aplicados al total
  tip: number; // Σ propinas
}

export interface CutSnapshot {
  sessionId: number;
  folio: string;
  shift: string | null;
  openingFloat: number;
  byMethod: CutMethodRow[];
  totalCollected: number; // Σ amount de todos los métodos (no voided)
  totalTips: number;
  cashCollected: number; // solo CASH.amount
  expectedCash: number; // openingFloat + cashCollected
  paymentsCount: number;
  comandasSettled: number; // comandas PAID ligadas a la sesión
  generatedAt: string; // ISO
}

const METHODS: PaymentMethod[] = ["CASH", "CARD_DEBIT", "CARD_CREDIT", "TRANSFER"];

/** Tolerancia de centavo para comparar contra el total (redondeos). */
export const PAY_EPS = 0.01;

export interface PayOutcome {
  remaining: number; // saldo ANTES de estos pagos
  sumAmount: number; // Σ montos aplicados
  sumTip: number; // Σ propinas
  changeTotal: number; // Σ cambio entregado
  newAmountPaid: number; // amountPaid resultante
  newRemaining: number; // saldo DESPUÉS
  settled: boolean; // ¿queda saldada?
  overpay: boolean; // ¿Σ montos excede el saldo? (el endpoint lo rechaza)
}

/**
 * Desenlace PURO de un cobro (sin DB) — fuente única de la matemática de pago.
 * `lines` ya validadas/normalizadas (amount>0, changeGiven, tip≥0).
 * `settled` cuando amountPaid alcanza el total (con tolerancia de centavo).
 */
export function computePaymentOutcome(
  total: number,
  alreadyPaid: number,
  lines: { amount: number; tip: number; changeGiven: number }[],
): PayOutcome {
  const remaining = round2(total - alreadyPaid);
  const sumAmount = round2(lines.reduce((s, l) => s + l.amount, 0));
  const sumTip = round2(lines.reduce((s, l) => s + l.tip, 0));
  const changeTotal = round2(lines.reduce((s, l) => s + l.changeGiven, 0));
  const newAmountPaid = round2(alreadyPaid + sumAmount);
  return {
    remaining,
    sumAmount,
    sumTip,
    changeTotal,
    newAmountPaid,
    newRemaining: round2(total - newAmountPaid),
    settled: newAmountPaid + PAY_EPS >= total,
    overpay: sumAmount > remaining + PAY_EPS,
  };
}

/** Resumen PURO del corte a partir del desglose por método + fondo inicial. */
export function summarizeCut(
  openingFloat: number,
  byMethod: CutMethodRow[],
): { totalCollected: number; totalTips: number; cashCollected: number; expectedCash: number; paymentsCount: number } {
  const totalCollected = round2(byMethod.reduce((s, r) => s + r.amount, 0));
  const totalTips = round2(byMethod.reduce((s, r) => s + r.tip, 0));
  const cashCollected = byMethod.find((r) => r.method === "CASH")?.amount ?? 0;
  return {
    totalCollected,
    totalTips,
    cashCollected,
    expectedCash: round2(round2(openingFloat) + cashCollected),
    paymentsCount: byMethod.reduce((s, r) => s + r.count, 0),
  };
}

/**
 * Corte de una sesión: agrega los pagos NO anulados por método (mismo patrón
 * que admin/reports, scoping por sesión). Sirve para el corte X (en vivo) y el
 * corte Z (al cerrar, se congela en cutSnapshot). `expectedCash` = fondo +
 * efectivo cobrado; las tarjetas/transferencias no tocan el cajón.
 */
export async function buildCut(cashSessionId: number, db: Db = prisma): Promise<CutSnapshot> {
  const session = await db.cashSession.findFirst({
    where: { id: cashSessionId, tenantId: TENANT },
    select: { id: true, folio: true, shift: true, openingFloat: true },
  });
  if (!session) throw new Error(`CashSession ${cashSessionId} no encontrada`);

  const [grouped, comandasSettled] = await Promise.all([
    db.comandaPayment.groupBy({
      by: ["method"],
      where: { tenantId: TENANT, cashSessionId, voided: false },
      _sum: { amount: true, tip: true },
      _count: { _all: true },
    }),
    db.comanda.count({ where: { tenantId: TENANT, cashSessionId, status: "PAID" } }),
  ]);

  const byId = new Map(grouped.map((g) => [g.method, g]));
  const byMethod: CutMethodRow[] = METHODS.map((method) => {
    const g = byId.get(method);
    return {
      method,
      count: g?._count._all ?? 0,
      amount: round2(Number(g?._sum.amount ?? 0)),
      tip: round2(Number(g?._sum.tip ?? 0)),
    };
  });

  const openingFloat = round2(Number(session.openingFloat));
  const s = summarizeCut(openingFloat, byMethod);

  return {
    sessionId: session.id,
    folio: session.folio,
    shift: session.shift,
    openingFloat,
    byMethod,
    totalCollected: s.totalCollected,
    totalTips: s.totalTips,
    cashCollected: s.cashCollected,
    expectedCash: s.expectedCash,
    paymentsCount: s.paymentsCount,
    comandasSettled,
    generatedAt: new Date().toISOString(),
  };
}
