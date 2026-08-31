/**
 * Tests de la división de cuenta en cuentas hijas. Sin DB.
 *   npx tsx --test tests/splitAccount.test.ts
 *
 * Ojo con no confundirla con splitBill.test.ts: aquella reparte UN ticket entre
 * comensales al imprimir; esta crea cuentas nuevas que viven por su cuenta.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { nextSplitLabel, canSplitAccount, SPLIT_SEP } from "../lib/comandaRules";

test("la primera división de la mesa 14 se llama 14-1", () => {
  assert.equal(nextSplitLabel("14", []), "14-1");
});

test("las siguientes divisiones siguen la numeración", () => {
  assert.equal(nextSplitLabel("14", ["14-1"]), "14-2");
  assert.equal(nextSplitLabel("14", ["14-1", "14-2"]), "14-3");
});

test("dividir una división anida el nombre", () => {
  assert.equal(nextSplitLabel("14-1", []), "14-1-1");
  assert.equal(nextSplitLabel("14-1", ["14-1-1"]), "14-1-2");
});

test("una nieta no altera la numeración de la abuela", () => {
  // "14-1-1" cuelga de "14-1", no de "14": la siguiente hija de 14 es la 2.
  assert.equal(nextSplitLabel("14", ["14-1", "14-1-1"]), "14-2");
});

test("no se recicla el número de una división que ya se cerró", () => {
  // Si la 14-2 se cobró y salió de la lista, la siguiente es la 3: dos cuentas
  // distintas con el mismo nombre en el mismo turno serían indistinguibles.
  assert.equal(nextSplitLabel("14", ["14-1", "14-3"]), "14-4");
});

test("el separador es guion, no punto", () => {
  assert.equal(SPLIT_SEP, "-");
  assert.ok(!nextSplitLabel("14", []).includes("."));
});

test("una cuenta con un solo producto no se divide", () => {
  const r = canSplitAccount({ totalUnits: 1, selectedUnits: 1 });
  assert.equal(r.ok, false);
});

test("no se divide sin elegir nada", () => {
  assert.equal(canSplitAccount({ totalUnits: 6, selectedUnits: 0 }).ok, false);
});

test("no se lleva todo: eso es un traspaso, no una división", () => {
  const r = canSplitAccount({ totalUnits: 6, selectedUnits: 6 });
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.error : "", /Traspasar/);
});

test("el reparto del ejemplo de la mesa 14 es válido", () => {
  // 1 pizza, 2 pastas, 3 ensaladas, 3 cervezas, 2 refrescos, 1 naranjada = 12
  // unidades; se llevan 2 pastas + 3 ensaladas + 1 naranjada = 6.
  assert.equal(canSplitAccount({ totalUnits: 12, selectedUnits: 6 }).ok, true);
});
