import { test } from "node:test";
import assert from "node:assert/strict";
import { allow, reset } from "../lib/rateLimit";

test("permite N y rechaza N+1", () => {
  const k = "rl:permite-" + Math.random();
  for (let i = 0; i < 5; i++) assert.equal(allow(k, 5, 60_000), true, `intento ${i + 1}`);
  assert.equal(allow(k, 5, 60_000), false); // el 6º se rechaza
});

test("reset() vuelve a permitir", () => {
  const k = "rl:reset-" + Math.random();
  for (let i = 0; i < 5; i++) allow(k, 5, 60_000);
  assert.equal(allow(k, 5, 60_000), false);
  reset(k);
  assert.equal(allow(k, 5, 60_000), true);
});

test("la ventana expira y vuelve a permitir", async () => {
  const k = "rl:window-" + Math.random();
  assert.equal(allow(k, 1, 30), true);  // consume el único permitido
  assert.equal(allow(k, 1, 30), false); // agotado dentro de la ventana
  await new Promise((r) => setTimeout(r, 45)); // deja expirar la ventana (30ms)
  assert.equal(allow(k, 1, 30), true);  // ventana nueva
});

test("llaves independientes no se comparten", () => {
  const a = "rl:a-" + Math.random();
  const b = "rl:b-" + Math.random();
  assert.equal(allow(a, 1, 60_000), true);
  assert.equal(allow(a, 1, 60_000), false);
  assert.equal(allow(b, 1, 60_000), true); // otra llave, bucket propio
});
