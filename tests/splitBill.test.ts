/**
 * Tests de los helpers PUROS de división de cuenta POR UNIDAD (Fase B.2). Sin DB.
 *   npx tsx --test tests/splitBill.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSplitsPayload,
  validateSplits,
  unitsSubtotal,
  effectiveTaxRate,
  divisionMoney,
} from "../lib/splitBill";

// ── buildSplitsPayload ──────────────────────────────────────────────
test("buildSplitsPayload: sin divisiones → undefined (impresión normal)", () => {
  assert.equal(buildSplitsPayload([], [{ itemId: 1, quantity: 2 }]), undefined);
});

test("buildSplitsPayload: qty=2 dividido 1-1 en 2 splits (matriz vacía)", () => {
  const splits = [new Map([[1, 1]]), new Map([[1, 1]])];
  assert.deepEqual(
    buildSplitsPayload(splits, []),
    [{ units: [{ itemId: 1, quantity: 1 }] }, { units: [{ itemId: 1, quantity: 1 }] }],
  );
});

test("buildSplitsPayload: qty=3 dividido 2-1 (matriz vacía)", () => {
  const splits = [new Map([[1, 2]]), new Map([[1, 1]])];
  assert.deepEqual(
    buildSplitsPayload(splits, []),
    [{ units: [{ itemId: 1, quantity: 2 }] }, { units: [{ itemId: 1, quantity: 1 }] }],
  );
});

test("buildSplitsPayload: qty=3 dividido 1-1-1 en 3 splits", () => {
  const splits = [new Map([[1, 1]]), new Map([[1, 1]]), new Map([[1, 1]])];
  assert.deepEqual(buildSplitsPayload(splits, []), [
    { units: [{ itemId: 1, quantity: 1 }] },
    { units: [{ itemId: 1, quantity: 1 }] },
    { units: [{ itemId: 1, quantity: 1 }] },
  ]);
});

test("buildSplitsPayload: matriz residual con qty parcial se anexa como ticket final", () => {
  // Item 1 (qty 3): 1 unidad en División 1; quedan 2 en matriz. Item 2 (qty 1) sin asignar.
  const splits = [new Map([[1, 1]])];
  const matrixUnits = [{ itemId: 1, quantity: 2 }, { itemId: 2, quantity: 1 }];
  assert.deepEqual(buildSplitsPayload(splits, matrixUnits), [
    { units: [{ itemId: 1, quantity: 1 }] },
    { units: [{ itemId: 1, quantity: 2 }, { itemId: 2, quantity: 1 }] },
  ]);
});

test("buildSplitsPayload: descarta unidades qty=0 y grupos vacíos", () => {
  const splits = [new Map([[1, 0]]), new Map([[2, 1]])];
  assert.deepEqual(buildSplitsPayload(splits, []), [{ units: [{ itemId: 2, quantity: 1 }] }]);
});

// ── validateSplits (defensa backend) ────────────────────────────────
const MAX = new Map([[1, 2], [2, 1]]);

test("validateSplits: split válido por unidad → ok", () => {
  const r = validateSplits([{ units: [{ itemId: 1, quantity: 1 }] }, { units: [{ itemId: 1, quantity: 1 }, { itemId: 2, quantity: 1 }] }], MAX);
  assert.deepEqual(r, { ok: true });
});

test("validateSplits: split con units vacíos → error", () => {
  const r = validateSplits([{ units: [] }], MAX);
  assert.equal(r.ok, false);
});

test("validateSplits: suma de cantidades > qty disponible → error", () => {
  // Item 1 tiene qty 2; se intentan dividir 3 (2 + 1) → excede.
  const r = validateSplits([{ units: [{ itemId: 1, quantity: 2 }] }, { units: [{ itemId: 1, quantity: 1 }] }], MAX);
  assert.equal(r.ok, false);
});

test("validateSplits: quantity 0 o negativa → error", () => {
  assert.equal(validateSplits([{ units: [{ itemId: 1, quantity: 0 }] }], MAX).ok, false);
  assert.equal(validateSplits([{ units: [{ itemId: 1, quantity: -1 }] }], MAX).ok, false);
});

test("validateSplits: itemId que no existe en la comanda → error", () => {
  assert.equal(validateSplits([{ units: [{ itemId: 99, quantity: 1 }] }], MAX).ok, false);
});

// ── unitsSubtotal ───────────────────────────────────────────────────
test("unitsSubtotal: Σ unitPrice×qty (precio unitario directo, sin drift)", () => {
  const priceById = new Map([[1, 200], [2, 180]]);
  assert.equal(unitsSubtotal([{ itemId: 1, quantity: 2 }, { itemId: 2, quantity: 1 }], priceById), 580);
});

// ── effectiveTaxRate ────────────────────────────────────────────────
test("effectiveTaxRate: deriva taxAmount/subtotal; 0 cuando subtotal es 0", () => {
  assert.equal(effectiveTaxRate({ subtotal: 1000, taxAmount: 160, total: 1160 }), 0.16);
  assert.equal(effectiveTaxRate({ subtotal: 0, taxAmount: 0, total: 0 }), 0);
});

// ── divisionMoney ───────────────────────────────────────────────────
test("divisionMoney: con IVA aplica la tasa; sin IVA el total es el subtotal", () => {
  assert.deepEqual(divisionMoney(1000, 0.16, true), { subtotal: 1000, taxAmount: 160, total: 1160 });
  assert.deepEqual(divisionMoney(1000, 0.16, false), { subtotal: 1000, taxAmount: 0, total: 1000 });
});

test("divisionMoney: redondea a 2 decimales", () => {
  assert.deepEqual(divisionMoney(333.33, 0.16, true), { subtotal: 333.33, taxAmount: 53.33, total: 386.66 });
});
