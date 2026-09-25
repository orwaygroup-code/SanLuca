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

// ── validateMovement (ajustados a la regla nueva de reasonCode, Ola A-4) ──
test("validateMovement: SALIDA mayor que el stock falla", () => {
  const r = validateMovement({ type: "SALIDA", quantity: 6, reasonCode: "Preparación del servicio", currentStock: 5 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "No hay suficiente: hay 5");
});

test("validateMovement: MERMA mayor que el stock falla", () => {
  const r = validateMovement({ type: "MERMA", quantity: 6, reasonCode: "Caducado", currentStock: 5 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "No hay suficiente: hay 5");
});

test("validateMovement: SALIDA exacta hasta 0 pasa", () => {
  assert.deepEqual(validateMovement({ type: "SALIDA", quantity: 5, reasonCode: "Preparación del servicio", currentStock: 5 }), { ok: true });
});

test("validateMovement: AJUSTE a 0 pasa", () => {
  assert.deepEqual(validateMovement({ type: "AJUSTE", quantity: 0, reasonCode: "Conteo físico", currentStock: 8 }), { ok: true });
});

test("validateMovement: cantidad 0 en SALIDA falla (antes que el motivo)", () => {
  const r = validateMovement({ type: "SALIDA", quantity: 0, reasonCode: "Preparación del servicio", currentStock: 5 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "La cantidad debe ser mayor que cero");
});

// ── validateMovement: motivo estructurado (Ola A-4) ──
test("validateMovement: un motivo válido de cada tipo pasa", () => {
  assert.deepEqual(validateMovement({ type: "ENTRADA", quantity: 1, reasonCode: "Compra a proveedor", currentStock: 100 }), { ok: true });
  assert.deepEqual(validateMovement({ type: "SALIDA", quantity: 1, reasonCode: "Preparación del servicio", currentStock: 100 }), { ok: true });
  assert.deepEqual(validateMovement({ type: "MERMA", quantity: 1, reasonCode: "Caducado", currentStock: 100 }), { ok: true });
  assert.deepEqual(validateMovement({ type: "AJUSTE", quantity: 1, reasonCode: "Conteo físico", currentStock: 100 }), { ok: true });
});

test("validateMovement: un motivo de OTRO tipo falla (Caducado en ENTRADA)", () => {
  const r = validateMovement({ type: "ENTRADA", quantity: 1, reasonCode: "Caducado", currentStock: 100 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "Motivo no válido");
});

test("validateMovement: sin motivo falla", () => {
  const r = validateMovement({ type: "SALIDA", quantity: 1, currentStock: 100 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "Elige un motivo");
});

test("validateMovement: 'Otro' sin comentario falla", () => {
  const r = validateMovement({ type: "SALIDA", quantity: 1, reasonCode: "Otro", reason: "   ", currentStock: 100 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "Explica el motivo en el comentario");
});

test("validateMovement: 'Otro' con comentario pasa", () => {
  assert.deepEqual(validateMovement({ type: "SALIDA", quantity: 1, reasonCode: "Otro", reason: "prueba de sabor del chef", currentStock: 100 }), { ok: true });
});

test("validateMovement: una merma con motivo y SIN comentario pasa (antes fallaba)", () => {
  assert.deepEqual(validateMovement({ type: "MERMA", quantity: 1, reasonCode: "Se echó a perder", currentStock: 100 }), { ok: true });
});

// Ex-tests de la regla vieja «El motivo es obligatorio», reescritos a la regla nueva.
test("validateMovement: MERMA sin motivo estructurado falla (antes: 'El motivo es obligatorio')", () => {
  const r = validateMovement({ type: "MERMA", quantity: 1, currentStock: 100 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "Elige un motivo");
});

test("validateMovement: AJUSTE sin motivo estructurado falla (antes: 'El motivo es obligatorio')", () => {
  const r = validateMovement({ type: "AJUSTE", quantity: 3, currentStock: 5 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "Elige un motivo");
});

// ── round3 ──
test("round3: redondea 2.5005 → 2.501 y 0.1+0.2 → 0.3", () => {
  assert.equal(round3(2.5005), 2.501);
  assert.equal(round3(0.1 + 0.2), 0.3);
});
