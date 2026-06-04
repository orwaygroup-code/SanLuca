/**
 * Tests del cálculo de totales de Comanda (IVA configurable). Sin DB.
 *   npx tsx --test tests/comandaTotals.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { computeTotals, lineTotal, round2 } from "../lib/comandaTotals";

test("lineTotal = (precio + extra) × cantidad, redondeado", () => {
  assert.equal(lineTotal(200, 2), 400);
  assert.equal(lineTotal(180, 1, 20), 200);
  assert.equal(lineTotal(99.99, 3), 299.97);
});

test("round2 redondea a centavos", () => {
  assert.equal(round2(86.20689), 86.21);
  assert.equal(round2(160), 160);
});

test("taxEnabled=true: IVA 16% incluido se desglosa hacia atrás", () => {
  const t = computeTotals([580, 580], { taxEnabled: true, taxRate: 0.16 });
  assert.equal(t.total, 1160);
  assert.equal(t.subtotal, 1000);   // 1160 / 1.16
  assert.equal(t.taxAmount, 160);   // 1160 - 1000
  assert.equal(round2(t.subtotal + t.taxAmount), t.total);
});

test("taxEnabled=true: caso no redondo cuadra a centavos", () => {
  const t = computeTotals([100], { taxEnabled: true, taxRate: 0.16 });
  assert.equal(t.total, 100);
  assert.equal(t.subtotal, 86.21);
  assert.equal(t.taxAmount, 13.79);
  assert.equal(round2(t.subtotal + t.taxAmount), t.total);
});

test("taxEnabled=false: subtotal === total y taxAmount === 0", () => {
  const t = computeTotals([400, 180, 350, 200, 80], { taxEnabled: false, taxRate: 0.16 });
  assert.equal(t.total, 1210);
  assert.equal(t.subtotal, 1210);
  assert.equal(t.taxAmount, 0);
});

test("comanda vacía → todo en 0", () => {
  const t = computeTotals([], { taxEnabled: true, taxRate: 0.16 });
  assert.deepEqual(t, { subtotal: 0, taxAmount: 0, total: 0 });
});
