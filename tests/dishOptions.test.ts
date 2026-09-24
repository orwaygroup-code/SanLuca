/**
 * Tests de lib/dishOptions (opciones por platillo, Fase Brunch B-2). Función pura.
 *   npx tsx --test tests/dishOptions.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { parseDishOptions, resolveSelection, type OptionGroup } from "../lib/dishOptions";

const groups: OptionGroup[] = [
  { group: "Salsa", required: true, max: 1, choices: [{ label: "Morita" }, { label: "Árbol" }] },
  { group: "Proteína", required: false, max: 1, choices: [{ label: "Arrachera", price: 99 }, { label: "Filete", price: 355 }] },
];

test("resolveSelection: válida CON extra (precio del grupo)", () => {
  const r = resolveSelection(groups, [{ group: "Salsa", label: "Morita" }, { group: "Proteína", label: "Arrachera" }]);
  if (!r.ok) throw new Error(r.error);
  assert.equal(r.extraCost, 99);
  assert.equal(r.modifiers, "Morita · Arrachera");
  assert.deepEqual(r.snapshot, [
    { group: "Salsa", label: "Morita" },
    { group: "Proteína", label: "Arrachera", price: 99 },
  ]);
});

test("resolveSelection: válida SIN extra", () => {
  const r = resolveSelection(groups, [{ group: "Salsa", label: "Árbol" }]);
  if (!r.ok) throw new Error(r.error);
  assert.equal(r.extraCost, 0);
  assert.equal(r.modifiers, "Árbol");
});

test("resolveSelection: required faltante", () => {
  const r = resolveSelection(groups, []);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error, "Elige Salsa");
});

test("resolveSelection: label inexistente", () => {
  const r = resolveSelection(groups, [{ group: "Salsa", label: "Verde" }]);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error, "Opción no válida: Verde");
});

test("resolveSelection: max excedido", () => {
  const r = resolveSelection(groups, [{ group: "Salsa", label: "Morita" }, { group: "Salsa", label: "Árbol" }]);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.error, "Solo puedes elegir 1 en Salsa");
});

test("resolveSelection: el precio sale del grupo aunque el pick mande otro", () => {
  // El pick trae un price falso; debe ignorarse y usarse el del grupo ($99).
  const r = resolveSelection(groups, [
    { group: "Salsa", label: "Morita" },
    { group: "Proteína", label: "Arrachera", price: 9999 } as { group: string; label: string },
  ]);
  if (!r.ok) throw new Error(r.error);
  assert.equal(r.extraCost, 99);
  assert.deepEqual(r.snapshot[1], { group: "Proteína", label: "Arrachera", price: 99 });
});

test("resolveSelection: platillo sin opciones", () => {
  const r = resolveSelection([], []);
  if (!r.ok) throw new Error(r.error);
  assert.equal(r.extraCost, 0);
  assert.equal(r.modifiers, "");
  assert.deepEqual(r.snapshot, []);
});

test("parseDishOptions: JSON inválido → []", () => {
  assert.deepEqual(parseDishOptions("{no es json"), []);
  assert.deepEqual(parseDishOptions(42), []);
  assert.deepEqual(parseDishOptions({ group: "x" }), []); // no es array
});

test("parseDishOptions: forma válida (objeto ya parseado y string JSON)", () => {
  const raw = [{ group: "Salsa", required: true, max: 1, choices: [{ label: "Morita" }, { label: "Arrachera", price: 99 }] }];
  const parsed = parseDishOptions(raw);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].group, "Salsa");
  assert.equal(parsed[0].choices[1].price, 99);
  // mismo resultado desde un string JSON
  assert.deepEqual(parseDishOptions(JSON.stringify(raw)), parsed);
});

test("desc: se conserva al parsear pero NO afecta la resolución", () => {
  const raw = [{
    group: "Estilo",
    required: true,
    max: 1,
    desc: "Cross Wagyu Americano",
    choices: [
      { label: "Rancheros", desc: "Tortilla nixtamalizada, frijoles refritos y salsa roja." },
      { label: "A la Mexicana", desc: "Huevo revuelto, jitomate, cebolla y chile." },
    ],
  }];
  const withDesc = parseDishOptions(raw);
  // parse conserva el desc del grupo y de cada choice
  assert.equal(withDesc[0].desc, "Cross Wagyu Americano");
  assert.equal(withDesc[0].choices[0].desc, "Tortilla nixtamalizada, frijoles refritos y salsa roja.");

  // los mismos grupos sin desc
  const noDesc: OptionGroup[] = [{
    group: "Estilo",
    required: true,
    max: 1,
    choices: [{ label: "Rancheros" }, { label: "A la Mexicana" }],
  }];

  const rWith = resolveSelection(withDesc, [{ group: "Estilo", label: "Rancheros" }]);
  const rNo = resolveSelection(noDesc, [{ group: "Estilo", label: "Rancheros" }]);
  if (!rWith.ok || !rNo.ok) throw new Error("no resolvió");
  // el desc no toca modifiers, extraCost ni snapshot
  assert.deepEqual(rWith, rNo);
  assert.equal(rWith.modifiers, "Rancheros");
  assert.equal(rWith.extraCost, 0);
  assert.deepEqual(rWith.snapshot, [{ group: "Estilo", label: "Rancheros" }]);
});

test("skipRequired: extra suelto sin el grupo obligatorio (falla sin, pasa con)", () => {
  // groups tiene "Salsa" (required) y "Proteína" (opcional). Elegir solo la proteína.
  const picks = [{ group: "Proteína", label: "Arrachera" }];
  const sinSkip = resolveSelection(groups, picks);
  assert.equal(sinSkip.ok, false);
  if (!sinSkip.ok) assert.equal(sinSkip.error, "Elige Salsa");

  const conSkip = resolveSelection(groups, picks, { skipRequired: true });
  if (!conSkip.ok) throw new Error(conSkip.error);
  assert.equal(conSkip.extraCost, 99);
  assert.equal(conSkip.modifiers, "Arrachera");
  assert.deepEqual(conSkip.snapshot, [{ group: "Proteína", label: "Arrachera", price: 99 }]);
});

test("skipRequired: el precio sigue saliendo del grupo, no del pick", () => {
  const r = resolveSelection(
    groups,
    [{ group: "Proteína", label: "Arrachera", price: 9999 } as { group: string; label: string }],
    { skipRequired: true },
  );
  if (!r.ok) throw new Error(r.error);
  assert.equal(r.extraCost, 99);
  assert.deepEqual(r.snapshot, [{ group: "Proteína", label: "Arrachera", price: 99 }]);
});

test("skipRequired: el max por grupo se sigue respetando", () => {
  const r = resolveSelection(
    groups,
    [{ group: "Proteína", label: "Arrachera" }, { group: "Proteína", label: "Filete" }],
    { skipRequired: true },
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "Solo puedes elegir 1 en Proteína");
});
