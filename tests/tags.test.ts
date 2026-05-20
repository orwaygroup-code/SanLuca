/**
 * Tests unitarios de helpers puros de tags.
 *
 * Ejecutar:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' --test tests/tags.test.ts
 * o (Node 22+):
 *   npx tsx --test tests/tags.test.ts
 *
 * NO toca DB. Solo helpers puros: normalizeTagName, swatch, isValidTagColor.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeTagName } from "../lib/tags";
import { swatch, isValidTagColor, TAG_COLORS, DEFAULT_TAG_COLOR } from "../lib/tagColors";

// ── normalizeTagName ─────────────────────────────────────────────────

test("normalizeTagName: trim simple", () => {
  assert.equal(normalizeTagName("  vip  "), "Vip");
});

test("normalizeTagName: capitaliza primera letra", () => {
  assert.equal(normalizeTagName("cumpleañero"), "Cumpleañero");
});

test("normalizeTagName: respeta mayúsculas internas (no las baja)", () => {
  assert.equal(normalizeTagName("vipPlus"), "VipPlus");
});

test("normalizeTagName: colapsa espacios internos múltiples", () => {
  assert.equal(normalizeTagName("Sin    gluten"), "Sin gluten");
});

test("normalizeTagName: input vacío devuelve cadena vacía", () => {
  assert.equal(normalizeTagName(""), "");
  assert.equal(normalizeTagName("   "), "");
});

test("normalizeTagName: nombre con acentos y ñ", () => {
  assert.equal(normalizeTagName("ñoño"), "Ñoño");
  assert.equal(normalizeTagName("ácido"), "Ácido");
});

test("normalizeTagName: nombre con números pega bien", () => {
  assert.equal(normalizeTagName("vip 2026"), "Vip 2026");
});

test("normalizeTagName: ya capitalizado se queda igual", () => {
  assert.equal(normalizeTagName("VIP"), "VIP");
});

// ── isValidTagColor ──────────────────────────────────────────────────

test("isValidTagColor: acepta los 7 tokens", () => {
  for (const c of TAG_COLORS) {
    assert.ok(isValidTagColor(c), `should accept "${c}"`);
  }
});

test("isValidTagColor: rechaza hex libre", () => {
  assert.equal(isValidTagColor("#ff0000"), false);
  assert.equal(isValidTagColor("red-500"), false);
});

test("isValidTagColor: rechaza no-string", () => {
  assert.equal(isValidTagColor(null), false);
  assert.equal(isValidTagColor(undefined), false);
  assert.equal(isValidTagColor(123), false);
  assert.equal(isValidTagColor({}), false);
});

test("isValidTagColor: case-sensitive — 'Slate' no es válido", () => {
  assert.equal(isValidTagColor("Slate"), false);
  assert.equal(isValidTagColor("RED"), false);
});

// ── swatch ───────────────────────────────────────────────────────────

test("swatch: devuelve trio { bg, border, text } para cada token", () => {
  for (const c of TAG_COLORS) {
    const s = swatch(c);
    assert.ok(s.bg.length > 0,     `bg empty for ${c}`);
    assert.ok(s.border.length > 0, `border empty for ${c}`);
    assert.ok(s.text.length > 0,   `text empty for ${c}`);
  }
});

test("swatch: fallback a DEFAULT_TAG_COLOR cuando llega color inválido", () => {
  const def = swatch(DEFAULT_TAG_COLOR);
  assert.deepEqual(swatch("invalid"), def);
  assert.deepEqual(swatch(""), def);
  assert.deepEqual(swatch(null), def);
  assert.deepEqual(swatch(undefined), def);
});

test("swatch: colores distintos producen estilos distintos", () => {
  // Garantía mínima de que no se "olvidó" un mapping y todos quedaron iguales.
  const seenBg = new Set(TAG_COLORS.map((c) => swatch(c).bg));
  assert.equal(seenBg.size, TAG_COLORS.length, "all 7 tokens should have distinct bg");
});
