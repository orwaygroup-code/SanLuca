/**
 * Tests del desglose de totales para la UI (IVA on/off). Sin DB.
 *   npx tsx --test tests/displayTotals.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildTotalLines, formatMXN } from "../lib/displayTotals";

test("con IVA activo muestra Subtotal + IVA + Total (Total marcado strong)", () => {
  const lines = buildTotalLines({ subtotal: 1000, taxAmount: 160, total: 1160 }, true);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[0], { label: "Subtotal", amount: 1000 });
  assert.deepEqual(lines[1], { label: "IVA", amount: 160 });
  assert.deepEqual(lines[2], { label: "Total", amount: 1160, strong: true });
});

test("sin IVA muestra SOLO el Total", () => {
  const lines = buildTotalLines({ subtotal: 1000, taxAmount: 0, total: 1000 }, false);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0], { label: "Total", amount: 1000, strong: true });
});

test("acepta montos como string (Decimal serializado de Prisma)", () => {
  const lines = buildTotalLines({ subtotal: "1000.50", taxAmount: "160.08", total: "1160.58" }, true);
  assert.equal(lines[0].amount, 1000.5);
  assert.equal(lines[1].amount, 160.08);
  assert.equal(lines[2].amount, 1160.58);
});

test("formatMXN da moneda mexicana con 2 decimales", () => {
  const s = formatMXN(1160.5);
  assert.ok(s.includes("1,160.50"), `esperaba 1,160.50 en "${s}"`);
});
