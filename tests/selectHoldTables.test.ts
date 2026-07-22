/**
 * Tests del selector de mesas a apartar por cupo (motor del bot).
 * Función pura, sin DB.
 *
 * Ejecutar:
 *   npx tsx --test tests/selectHoldTables.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { selectHoldTables } from "../lib/autoAssignTable";

const T = (id: string, number: number, capacity: number) => ({ id, number, capacity });

test("cubre el cupo con la menor cantidad de mesas (mayor capacidad primero)", () => {
  const free = [T("a", 1, 2), T("b", 2, 2), T("c", 3, 6), T("d", 4, 4)];
  const held = selectHoldTables(free, 10);
  assert.ok(held);
  // 6 + 4 = 10 → mesas 3 y 4, devueltas ordenadas por número
  assert.deepEqual(held!.map((t) => t.number), [3, 4]);
});

test("devuelve las mesas ordenadas por número", () => {
  const free = [T("a", 5, 6), T("b", 1, 6)];
  const held = selectHoldTables(free, 8);
  assert.ok(held);
  assert.deepEqual(held!.map((t) => t.number), [1, 5]);
});

test("una sola mesa basta si su capacidad cubre el cupo", () => {
  const free = [T("a", 1, 4), T("b", 2, 6)];
  const held = selectHoldTables(free, 6);
  assert.ok(held);
  assert.deepEqual(held!.map((t) => t.number), [2]);
});

test("null si no alcanza el cupo ni juntando todo", () => {
  const free = [T("a", 1, 2), T("b", 2, 2)];
  assert.equal(selectHoldTables(free, 10), null);
});

test("null si requiere más de 4 mesas (cinco de 2 = 8 en 4 mesas < 10)", () => {
  const free = [T("a", 1, 2), T("b", 2, 2), T("c", 3, 2), T("d", 4, 2), T("e", 5, 2)];
  assert.equal(selectHoldTables(free, 10), null);
});

test("usa exactamente 4 mesas cuando alcanza justo", () => {
  const free = [T("a", 1, 2), T("b", 2, 2), T("c", 3, 2), T("d", 4, 2)];
  const held = selectHoldTables(free, 8);
  assert.ok(held);
  assert.equal(held!.length, 4);
});
