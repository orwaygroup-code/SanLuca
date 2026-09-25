/**
 * Tests de lib/stock (almacén, Ola A-1). Funciones puras.
 *   npx tsx --test tests/stock.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { nextBalance, validateMovement, round3 } from "../lib/stock";

// ── nextBalance ──
test("nextBalance: ENTRADA suma", () => {
  assert.equal(nextBalance(10, "ENTRADA", 2.5), 12.5);
});

test("nextBalance: SALIDA resta", () => {
  assert.equal(nextBalance(12.4, "SALIDA", 2.5), 9.9);
});

test("nextBalance: MERMA resta", () => {
  assert.equal(nextBalance(5, "MERMA", 1.25), 3.75);
});

test("nextBalance: AJUSTE fija el saldo (conteo físico, no diferencia)", () => {
  assert.equal(nextBalance(999, "AJUSTE", 7.5), 7.5);
});

// ── validateMovement ──
test("validateMovement: SALIDA mayor que el stock falla", () => {
  const r = validateMovement({ type: "SALIDA", quantity: 6, currentStock: 5 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "No hay suficiente: hay 5");
});

test("validateMovement: MERMA mayor que el stock falla", () => {
  const r = validateMovement({ type: "MERMA", quantity: 6, reason: "se cayó", currentStock: 5 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "No hay suficiente: hay 5");
});

test("validateMovement: SALIDA exacta hasta 0 pasa", () => {
  assert.deepEqual(validateMovement({ type: "SALIDA", quantity: 5, currentStock: 5 }), { ok: true });
});

test("validateMovement: AJUSTE a 0 pasa", () => {
  assert.deepEqual(validateMovement({ type: "AJUSTE", quantity: 0, reason: "conteo", currentStock: 8 }), { ok: true });
});

test("validateMovement: MERMA sin motivo falla, con motivo pasa", () => {
  const sin = validateMovement({ type: "MERMA", quantity: 1, currentStock: 5 });
  assert.equal(sin.ok, false);
  if (!sin.ok) assert.equal(sin.error, "El motivo es obligatorio");
  assert.deepEqual(validateMovement({ type: "MERMA", quantity: 1, reason: "  se tiró  ", currentStock: 5 }), { ok: true });
});

test("validateMovement: AJUSTE sin motivo falla", () => {
  const r = validateMovement({ type: "AJUSTE", quantity: 3, currentStock: 5 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "El motivo es obligatorio");
});

test("validateMovement: cantidad 0 en SALIDA falla", () => {
  const r = validateMovement({ type: "SALIDA", quantity: 0, currentStock: 5 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "La cantidad debe ser mayor que cero");
});

// ── round3 ──
test("round3: redondea 2.5005 → 2.501 y 0.1+0.2 → 0.3", () => {
  assert.equal(round3(2.5005), 2.501);
  assert.equal(round3(0.1 + 0.2), 0.3);
});
