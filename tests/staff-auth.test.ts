/**
 * Tests del hashing de PIN de Staff (bcrypt cost 8). Sin DB.
 *
 * Ejecutar:
 *   npx tsx --test tests/staff-auth.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { hashPin, verifyPin, generatePin, isValidPin, PIN_LENGTH } from "../lib/staff-auth";

test("login con PIN correcto: verifyPin → true", async () => {
  const hash = await hashPin("4821");
  assert.equal(await verifyPin("4821", hash), true);
});

test("login con PIN incorrecto: verifyPin → false", async () => {
  const hash = await hashPin("4821");
  assert.equal(await verifyPin("0000", hash), false);
  assert.equal(await verifyPin("482", hash), false);
  assert.equal(await verifyPin("48210", hash), false);
});

test("usa bcrypt cost 8 y salt distinto por hash", async () => {
  const a = await hashPin("1234");
  const b = await hashPin("1234");
  assert.match(a, /^\$2[aby]\$0?8\$/); // cost 8
  assert.notEqual(a, b);               // salts distintos
  assert.equal(await verifyPin("1234", a), true);
  assert.equal(await verifyPin("1234", b), true);
});

test("reset de PIN: el hash nuevo valida el PIN nuevo y rechaza el viejo", async () => {
  const oldPin = "1111";
  const newPin = "9876";
  const oldHash = await hashPin(oldPin);
  // … reset …
  const newHash = await hashPin(newPin);
  assert.equal(await verifyPin(newPin, newHash), true);  // nuevo PIN entra
  assert.equal(await verifyPin(oldPin, newHash), false); // viejo PIN ya no
  assert.notEqual(newHash, oldHash);
});

test("isValidPin acepta solo 4 dígitos", () => {
  assert.equal(isValidPin("0000"), true);
  assert.equal(isValidPin("12a4"), false);
  assert.equal(isValidPin("123"), false);
  assert.equal(isValidPin(""), false);
});

test("generatePin produce 4 dígitos (con ceros a la izquierda)", () => {
  for (let i = 0; i < 200; i++) {
    const pin = generatePin();
    assert.equal(pin.length, PIN_LENGTH);
    assert.equal(isValidPin(pin), true);
  }
});
