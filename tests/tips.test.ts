/**
 * Tests de la matemática de reparto de propinas / puntos (funciones PURAS, sin DB).
 *   npx tsx --test tests/tips.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TIP_AREAS, sumAreaPercents, computeDeduction, computeNetTip, distributeToAreas, normalizeAreas,
} from "../lib/tips";

test("el punto = suma de los % de área (default = 7%)", () => {
  assert.equal(sumAreaPercents(DEFAULT_TIP_AREAS), 7);
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

test("reparto a áreas (ejemplo $1,000): barra 20, cocina 25, garroteros 10, encargados 10, caja 5", () => {
  const d = distributeToAreas(1000, DEFAULT_TIP_AREAS);
  const by = Object.fromEntries(d.map((a) => [a.name, a.amount]));
  assert.equal(by["Barra"], 20);
  assert.equal(by["Cocina"], 25);
  assert.equal(by["Garroteros"], 10);
  assert.equal(by["Encargados"], 10);
  assert.equal(by["Caja"], 5);
  assert.equal(d.reduce((s, a) => s + a.amount, 0), 70); // = el descuento total
});

test("normalizeAreas: parsea JSON guardado o cae al default", () => {
  assert.deepEqual(normalizeAreas({ areas: [{ name: "Barra", percent: 3 }] }), [{ name: "Barra", percent: 3 }]);
  assert.deepEqual(normalizeAreas(null), DEFAULT_TIP_AREAS);
  assert.deepEqual(normalizeAreas({ areas: [] }), DEFAULT_TIP_AREAS);
});
