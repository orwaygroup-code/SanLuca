/**
 * Tests del reparto de cobro (PURO, sin DB): billPortion + cambio (efectivo) o
 * propina (tarjeta/transfer) a partir de lo que entrega el cliente por método.
 *   npx tsx --test tests/paymentSplit.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { splitPaymentLines } from "../lib/paymentSplit";

test("un pago en efectivo exacto: cubre todo, sin cambio ni propina", () => {
  const [c] = splitPaymentLines([{ method: "CASH", tendered: 1897 }], 1897);
  assert.equal(c.billPortion, 1897);
  assert.equal(c.change, 0);
  assert.equal(c.tip, 0);
});

test("efectivo mayor al saldo → el excedente es CAMBIO (no propina)", () => {
  const [c] = splitPaymentLines([{ method: "CASH", tendered: 2000 }], 1897);
  assert.equal(c.billPortion, 1897);
  assert.equal(c.change, 103);
  assert.equal(c.tip, 0);
});

test("tarjeta mayor al saldo → el excedente es PROPINA del mesero (no cambio)", () => {
  const [c] = splitPaymentLines([{ method: "CARD_CREDIT", tendered: 2000 }], 1897);
  assert.equal(c.billPortion, 1897);
  assert.equal(c.tip, 103);
  assert.equal(c.change, 0);
});

test("transferencia también manda el excedente a propina", () => {
  const [c] = splitPaymentLines([{ method: "TRANSFER", tendered: 1950 }], 1897);
  assert.equal(c.billPortion, 1897);
  assert.equal(c.tip, 53);
  assert.equal(c.change, 0);
});

test("mixto: $1000 efectivo deja faltando $897; el 2º método ve remainingBefore=897", () => {
  const rows = splitPaymentLines(
    [{ method: "CASH", tendered: 1000 }, { method: "CARD_DEBIT", tendered: 897 }],
    1897,
  );
  assert.equal(rows[0].billPortion, 1000);
  assert.equal(rows[0].change, 0);
  assert.equal(rows[1].remainingBefore, 897); // "falta 897" para el 2º pago
  assert.equal(rows[1].billPortion, 897);
  assert.equal(rows[1].tip, 0);
  const covered = rows.reduce((s, r) => s + r.billPortion, 0);
  assert.equal(covered, 1897); // salda la cuenta
});

test("mixto con propina en el 2º: $1000 efectivo + $1000 tarjeta → cubre 897 y $103 de propina", () => {
  const rows = splitPaymentLines(
    [{ method: "CASH", tendered: 1000 }, { method: "CARD_CREDIT", tendered: 1000 }],
    1897,
  );
  assert.equal(rows[1].remainingBefore, 897);
  assert.equal(rows[1].billPortion, 897);
  assert.equal(rows[1].tip, 103); // excedente sobre lo que faltaba → propina
  assert.equal(rows[1].change, 0);
});

test("abono parcial: $500 de $1897 → cubre 500, queda faltando", () => {
  const [c] = splitPaymentLines([{ method: "CASH", tendered: 500 }], 1897);
  assert.equal(c.billPortion, 500);
  assert.equal(c.change, 0);
  assert.equal(c.tip, 0);
});

test("una línea después de saldar (remainingBefore 0): no cubre nada; excedente completo", () => {
  const rows = splitPaymentLines(
    [{ method: "CASH", tendered: 1897 }, { method: "CARD_CREDIT", tendered: 200 }],
    1897,
  );
  assert.equal(rows[1].remainingBefore, 0);
  assert.equal(rows[1].billPortion, 0);
  assert.equal(rows[1].tip, 200); // todo es propina porque ya no falta nada
});
