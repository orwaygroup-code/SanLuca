/**
 * Tests de la matemática de CAJA (POS) — funciones PURAS, sin DB.
 *   npx tsx --test tests/caja.test.ts
 *
 * Cubre: descuentos (+ desglose de IVA), desenlace de cobro (parcial/mixto/
 * saldado/sobrepago/cambio) y resumen del corte (esperado en efectivo + propinas).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { computeTotals, computeDiscountAmount, round2 } from "../lib/comandaTotals";
import { computePaymentOutcome, summarizeCut, type CutMethodRow } from "../lib/caja";

// ── computeDiscountAmount ───────────────────────────────────────────────────

test("descuento PERCENT: base × value/100", () => {
  assert.equal(computeDiscountAmount(1000, "PERCENT", 10), 100);
  assert.equal(computeDiscountAmount(580, "PERCENT", 15), 87);
});

test("descuento FIXED: value en pesos", () => {
  assert.equal(computeDiscountAmount(1000, "FIXED", 250), 250);
});

test("descuento se acota a [0, base] (nunca deja total negativo)", () => {
  assert.equal(computeDiscountAmount(200, "FIXED", 500), 200); // cap al base
  assert.equal(computeDiscountAmount(200, "PERCENT", 150), 200); // 150% → base
  assert.equal(computeDiscountAmount(0, "FIXED", 50), 0); // sin base
  assert.equal(computeDiscountAmount(100, "FIXED", 0), 0); // sin valor
  assert.equal(computeDiscountAmount(100, "PERCENT", -5), 0); // negativo → 0
});

test("descuento + IVA: se desglosa sobre el bruto YA descontado", () => {
  // Bruto 1160 (IVA incl.), 10% descuento → 1044; IVA 16% hacia atrás.
  const disc = computeDiscountAmount(1160, "PERCENT", 10);
  assert.equal(disc, 116);
  const gross = round2(1160 - disc);
  const t = computeTotals([gross], { taxEnabled: true, taxRate: 0.16 });
  assert.equal(t.total, 1044);
  assert.equal(t.subtotal, 900); // 1044 / 1.16
  assert.equal(t.taxAmount, 144);
  assert.equal(round2(t.subtotal + t.taxAmount), t.total);
});

// ── computePaymentOutcome ───────────────────────────────────────────────────

test("cobro total en efectivo: saldada, sin saldo, cambio correcto", () => {
  const o = computePaymentOutcome(500, 0, [{ amount: 500, tip: 0, changeGiven: 100 }]);
  assert.equal(o.settled, true);
  assert.equal(o.newAmountPaid, 500);
  assert.equal(o.newRemaining, 0);
  assert.equal(o.changeTotal, 100);
  assert.equal(o.overpay, false);
});

test("cobro parcial: no saldada, saldo restante", () => {
  const o = computePaymentOutcome(1000, 0, [{ amount: 400, tip: 0, changeGiven: 0 }]);
  assert.equal(o.settled, false);
  assert.equal(o.newRemaining, 600);
});

test("segundo abono salda la cuenta (parcial acumulado)", () => {
  const o = computePaymentOutcome(1000, 400, [{ amount: 600, tip: 0, changeGiven: 0 }]);
  assert.equal(o.remaining, 600);
  assert.equal(o.settled, true);
  assert.equal(o.newRemaining, 0);
});

test("pago MIXTO (tarjeta + efectivo) salda y suma propinas", () => {
  const o = computePaymentOutcome(1000, 0, [
    { amount: 600, tip: 50, changeGiven: 0 }, // tarjeta
    { amount: 400, tip: 30, changeGiven: 20 }, // efectivo, recibió 420
  ]);
  assert.equal(o.sumAmount, 1000);
  assert.equal(o.sumTip, 80);
  assert.equal(o.changeTotal, 20);
  assert.equal(o.settled, true);
  assert.equal(o.newRemaining, 0);
});

test("sobrepago se detecta (Σ monto > saldo)", () => {
  const o = computePaymentOutcome(500, 0, [{ amount: 600, tip: 0, changeGiven: 0 }]);
  assert.equal(o.overpay, true);
});

test("tolerancia de centavo: salda con residual de redondeo", () => {
  const o = computePaymentOutcome(100.01, 100, [{ amount: 0.01, tip: 0, changeGiven: 0 }]);
  assert.equal(o.settled, true);
  // aún saldada aunque falte 1 centavo por redondeo
  const o2 = computePaymentOutcome(100, 99.995, []);
  assert.equal(o2.settled, true);
});

test("la propina NO cuenta al saldo del total", () => {
  const o = computePaymentOutcome(500, 0, [{ amount: 500, tip: 75, changeGiven: 0 }]);
  assert.equal(o.settled, true);
  assert.equal(o.newRemaining, 0);
  assert.equal(o.sumTip, 75);
});

// ── summarizeCut ────────────────────────────────────────────────────────────

const rows = (o: Partial<Record<CutMethodRow["method"], Partial<CutMethodRow>>>): CutMethodRow[] =>
  (["CASH", "CARD_DEBIT", "CARD_CREDIT", "TRANSFER"] as const).map((method) => ({
    method,
    count: o[method]?.count ?? 0,
    amount: o[method]?.amount ?? 0,
    tip: o[method]?.tip ?? 0,
  }));

test("corte: efectivo esperado = fondo + efectivo cobrado (tarjetas no tocan cajón)", () => {
  const s = summarizeCut(1500, rows({
    CASH: { amount: 3200, tip: 100, count: 8 },
    CARD_CREDIT: { amount: 5000, tip: 400, count: 6 },
  }));
  assert.equal(s.cashCollected, 3200);
  assert.equal(s.expectedCash, 4700); // 1500 + 3200
  assert.equal(s.totalCollected, 8200); // 3200 + 5000
  assert.equal(s.totalTips, 500);
  assert.equal(s.paymentsCount, 14);
});

test("corte sin movimientos: esperado = solo el fondo", () => {
  const s = summarizeCut(1000, rows({}));
  assert.equal(s.expectedCash, 1000);
  assert.equal(s.totalCollected, 0);
  assert.equal(s.paymentsCount, 0);
});

test("corte: diferencia de arqueo (sobra/falta)", () => {
  const s = summarizeCut(1000, rows({ CASH: { amount: 2000, count: 5 } }));
  assert.equal(round2(2950 - s.expectedCash), -50); // faltan $50
  assert.equal(round2(3010 - s.expectedCash), 10); // sobran $10
});
