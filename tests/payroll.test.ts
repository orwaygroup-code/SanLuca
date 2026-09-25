/**
 * Tests de lib/payroll (nómina, Ola N-1). Funciones puras.
 *   npx tsx --test tests/payroll.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { currentSalary, netPay } from "../lib/payroll";

const d = (s: string) => new Date(`${s}T00:00:00.000-06:00`);
const AT = d("2026-06-01");

// ── currentSalary ──
test("currentSalary: tres registros desordenados → el más reciente ya vigente", () => {
  const rows = [
    { id: 1, effectiveFrom: d("2026-01-01"), amount: 3000 },
    { id: 3, effectiveFrom: d("2026-05-01"), amount: 3800 },
    { id: 2, effectiveFrom: d("2026-03-01"), amount: 3500 },
  ];
  assert.equal(currentSalary(rows, AT)?.id, 3);
});

test("currentSalary: uno con fecha futura se ignora", () => {
  const rows = [
    { id: 1, effectiveFrom: d("2026-05-01"), amount: 3800 },
    { id: 2, effectiveFrom: d("2026-12-01"), amount: 4200 }, // futuro respecto a AT
  ];
  assert.equal(currentSalary(rows, AT)?.id, 1);
});

test("currentSalary: todos futuros → null", () => {
  const rows = [
    { id: 1, effectiveFrom: d("2026-07-01"), amount: 3800 },
    { id: 2, effectiveFrom: d("2026-08-01"), amount: 4200 },
  ];
  assert.equal(currentSalary(rows, AT), null);
});

test("currentSalary: lista vacía → null", () => {
  assert.equal(currentSalary([], AT), null);
});

test("currentSalary: empate de fecha resuelve por id mayor", () => {
  const rows = [
    { id: 7, effectiveFrom: d("2026-05-01"), amount: 3500 },
    { id: 9, effectiveFrom: d("2026-05-01"), amount: 3900 },
    { id: 4, effectiveFrom: d("2026-05-01"), amount: 3100 },
  ];
  assert.equal(currentSalary(rows, AT)?.id, 9);
});

// ── netPay ──
test("netPay: neto normal (3500 − 1200 = 2300, carry 0)", () => {
  assert.deepEqual(netPay(3500, 1200), { net: 2300, carry: 0 });
});

test("netPay: crédito mayor que el sueldo (3500 − 4000 → net 0, carry 500)", () => {
  assert.deepEqual(netPay(3500, 4000), { net: 0, carry: 500 });
});

test("netPay: crédito cero → net = sueldo", () => {
  assert.deepEqual(netPay(3500, 0), { net: 3500, carry: 0 });
});
