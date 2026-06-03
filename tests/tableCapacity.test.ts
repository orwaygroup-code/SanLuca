/**
 * Tests del predicado de capacidad y del override (Fase A).
 * Sin DB.
 *
 * Ejecutar:
 *   npx tsx --test tests/tableCapacity.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { tableFitsGuests, combinedCapacity, evaluateCapacity } from "../lib/tableCapacity";

test("tableFitsGuests: cabe si capacity >= guests", () => {
  assert.equal(tableFitsGuests(4, 4), true);
  assert.equal(tableFitsGuests(6, 4), true);
  assert.equal(tableFitsGuests(2, 4), false);
});

test("tableFitsGuests: excepción mesa de 6 admite 8", () => {
  assert.equal(tableFitsGuests(6, 8), true);
  assert.equal(tableFitsGuests(4, 8), false);
});

test("combinedCapacity suma cupos", () => {
  assert.equal(combinedCapacity([4, 4]), 8);
  assert.equal(combinedCapacity([2, 4, 4]), 10);
  assert.equal(combinedCapacity([]), 0);
});

test("evaluateCapacity: capacidad suficiente → ok, sin override", () => {
  const d = evaluateCapacity(4, 4, false);
  assert.deepEqual(d, { ok: true, requiresOverride: false, capacity: 4, guests: 4 });
});

test("force=false con capacidad insuficiente → RECHAZA (ok=false, requiresOverride)", () => {
  const d = evaluateCapacity(2, 4, false);
  assert.equal(d.ok, false);
  assert.equal(d.requiresOverride, true);
});

test("force=true con capacidad insuficiente → PERMITE con override (auditoría)", () => {
  const d = evaluateCapacity(2, 4, true);
  assert.equal(d.ok, true);
  assert.equal(d.requiresOverride, true);
});

test("excepción 6→8 no requiere override aunque capacity < guests", () => {
  const d = evaluateCapacity(6, 8, false);
  assert.equal(d.ok, true);
  assert.equal(d.requiresOverride, false);
});
