/**
 * Reglas que protegen el dinero de la cuenta. Sin DB.
 *   npx tsx --test tests/billIntegrity.test.ts
 *
 * Las dos nacen de fallos reproducidos en el banco de escenarios: se podía
 * cobrar una cuenta reabierta con el ticket viejo, y el descuento a la cuenta
 * se evaporaba al mover productos.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { hasCurrentBillPrint, splitBillDiscount } from "../lib/comandaRules";

// ── ticket vigente ───────────────────────────────────────────────────────────

test("sin ticket impreso no hay ticket vigente", () => {
  assert.equal(hasCurrentBillPrint({ lastFinalPrintAt: null, lastReopenAt: null }), false);
});

test("impresa y nunca reabierta: vigente", () => {
  assert.equal(hasCurrentBillPrint({ lastFinalPrintAt: "2026-08-30T20:00:00Z", lastReopenAt: null }), true);
});

test("reabierta DESPUÉS de imprimir: el ticket deja de valer", () => {
  // Este es el caso que permitía cobrar 1740 con un papel de 375.
  assert.equal(hasCurrentBillPrint({
    lastFinalPrintAt: "2026-08-30T20:00:00Z",
    lastReopenAt:     "2026-08-30T20:30:00Z",
  }), false);
});

test("reimpresa después de reabrir: vuelve a valer", () => {
  assert.equal(hasCurrentBillPrint({
    lastFinalPrintAt: "2026-08-30T21:00:00Z",
    lastReopenAt:     "2026-08-30T20:30:00Z",
  }), true);
});

test("acepta objetos Date, no solo cadenas", () => {
  assert.equal(hasCurrentBillPrint({
    lastFinalPrintAt: new Date("2026-08-30T21:00:00Z"),
    lastReopenAt:     new Date("2026-08-30T20:30:00Z"),
  }), true);
});

// ── reparto del descuento a la cuenta ────────────────────────────────────────

test("sin descuento no hay nada que repartir", () => {
  assert.deepEqual(splitBillDiscount({ discountTotal: 0, movedGross: 500, totalGross: 1000 }), { moved: 0, remaining: 0 });
});

test("la mitad del consumo se lleva la mitad del descuento", () => {
  assert.deepEqual(splitBillDiscount({ discountTotal: 200, movedGross: 500, totalGross: 1000 }), { moved: 100, remaining: 100 });
});

test("el caso que sobrecobraba 445: el descuento sigue a los productos", () => {
  // Bruto 1680, descuento 840. Se llevan 1285 de consumo.
  const r = splitBillDiscount({ discountTotal: 840, movedGross: 1285, totalGross: 1680 });
  const padre = Math.max(0, 1680 - 1285 - r.remaining);
  const hijo = Math.max(0, 1285 - r.moved);
  // Antes: padre 0 + hijo 1285 = 1285 (esperado 840).
  assert.ok(Math.abs(padre + hijo - 840) < 0.02, `suma ${padre + hijo}, esperado 840`);
});

test("llevarse todo se lleva todo el descuento", () => {
  assert.deepEqual(splitBillDiscount({ discountTotal: 200, movedGross: 1000, totalGross: 1000 }), { moved: 200, remaining: 0 });
});

test("no se reparte más de lo que hay aunque los números vengan raros", () => {
  const r = splitBillDiscount({ discountTotal: 200, movedGross: 5000, totalGross: 1000 });
  assert.equal(r.moved, 200);
  assert.equal(r.remaining, 0);
});

test("una cuenta sin consumo no reparte nada", () => {
  assert.deepEqual(splitBillDiscount({ discountTotal: 200, movedGross: 0, totalGross: 0 }), { moved: 0, remaining: 200 });
});

test("se reparte con dos decimales, sin arrastrar fracciones", () => {
  const r = splitBillDiscount({ discountTotal: 100, movedGross: 333.33, totalGross: 1000 });
  assert.equal(r.moved, 33.33);
  assert.equal(r.remaining, 66.67);
  assert.equal(Math.round((r.moved + r.remaining) * 100) / 100, 100);
});
