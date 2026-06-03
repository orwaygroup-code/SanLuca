/**
 * Tests del resolver de mesas al EDITAR una reserva (Fase A).
 * Garantiza que editar NO mueve la mesa. Sin DB.
 *
 * Ejecutar:
 *   npx tsx --test tests/reservationTables.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveEditTables } from "../lib/reservationTables";

const current = {
  tableId: "tA", linkedTableId: "tB", thirdTableId: null, fourthTableId: null,
};

test("editar SIN mesa en el body → preserva la mesa actual (no se mueve)", () => {
  const out = resolveEditTables({}, current);
  assert.deepEqual(out, current);
});

test("body con campos pero sin tableId → igual preserva la actual", () => {
  const out = resolveEditTables({ linkedTableId: "tZ" }, current);
  assert.deepEqual(out, current);
});

test("editar CON mesa explícita → usa la selección del body", () => {
  const out = resolveEditTables({ tableId: "tX", linkedTableId: "tY" }, current);
  assert.deepEqual(out, { tableId: "tX", linkedTableId: "tY", thirdTableId: null, fourthTableId: null });
});

test("mesa explícita simple → limpia combinadas no enviadas", () => {
  const out = resolveEditTables({ tableId: "tX" }, current);
  assert.deepEqual(out, { tableId: "tX", linkedTableId: null, thirdTableId: null, fourthTableId: null });
});

test("preserva combinadas de la reserva actual cuando no se manda mesa", () => {
  const combined = { tableId: "t1", linkedTableId: "t2", thirdTableId: "t3", fourthTableId: "t4" };
  assert.deepEqual(resolveEditTables({}, combined), combined);
});
