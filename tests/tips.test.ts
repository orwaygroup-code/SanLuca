/**
 * Tests de la matemática de reparto de propinas / puntos (funciones PURAS, sin DB).
 *   npx tsx --test tests/tips.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TIP_AREAS, DEFAULT_POINT_PERCENT, sumAreaPercents,
  computeDeduction, computeNetTip, distributePool, normalizePolicy,
} from "../lib/tips";

test("punto default = 7%", () => {
  assert.equal(DEFAULT_POINT_PERCENT, 7);
});

test("descuento = punto% × venta (ejemplo: $1,000 al 7% = $70)", () => {
  assert.equal(computeDeduction(1000, 7), 70);
  assert.equal(computeDeduction(580, 7), 40.6);
});

test("neto = propinas + efectivo declarado − descuento (puede ser negativo)", () => {
  assert.equal(computeNetTip(100, 0, 70), 30);
  assert.equal(computeNetTip(50, 0, 70), -20); // le tocan $70 pero solo declaró $50 → −20
  assert.equal(computeNetTip(40, 40, 70), 10); // tarjeta 40 + efectivo 40 − 70
});

test("reparto proporcional del pool (pool $70): barra 20, cocina 25, garroteros 10, encargados 10, caja 5", () => {
  const d = distributePool(70, DEFAULT_TIP_AREAS);
  const by = Object.fromEntries(d.map((a) => [a.name, a.amount]));
  assert.equal(by["Barra"], 20);
  assert.equal(by["Cocina"], 25);
  assert.equal(by["Garroteros"], 10);
  assert.equal(by["Encargados"], 10);
  assert.equal(by["Caja"], 5);
  assert.equal(d.reduce((s, a) => s + a.amount, 0), 70); // reparte el 100% del pool
});

test("distributePool reparte el 100% aunque los pesos no sumen el punto", () => {
  const d = distributePool(100, [{ name: "A", percent: 1 }, { name: "B", percent: 3 }]);
  assert.equal(d.find((x) => x.name === "A")!.amount, 25); // 100 × 1/4
  assert.equal(d.find((x) => x.name === "B")!.amount, 75); // 100 × 3/4
});

test("sumAreaPercents", () => {
  assert.equal(sumAreaPercents(DEFAULT_TIP_AREAS), 7);
});

test("normalizePolicy: parsea { pointPercent, areas } o cae al default", () => {
  const p = normalizePolicy({ pointPercent: 8, areas: [{ name: "Barra", percent: 3 }] });
  assert.equal(p.pointPercent, 8);
  assert.deepEqual(p.areas, [{ name: "Barra", percent: 3 }]);
  assert.equal(normalizePolicy(null).pointPercent, 7);
  assert.deepEqual(normalizePolicy({ areas: [] }).areas, DEFAULT_TIP_AREAS);
});
