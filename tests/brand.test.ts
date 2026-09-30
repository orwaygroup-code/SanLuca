import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBrand } from "../lib/brand";

// resolveBrand recibe un env plano (no process.env real) para ser determinista.
function env(vars: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return vars as NodeJS.ProcessEnv;
}

test("las dos variables puestas: cada una en su campo", () => {
  const b = resolveBrand(env({ RESTAURANT_NAME: "San Luca Ristorante", RESTAURANT_SHORT_NAME: "San Luca" }));
  assert.equal(b.name, "San Luca Ristorante");
  assert.equal(b.shortName, "San Luca");
});

test("solo RESTAURANT_NAME: shortName cae a name", () => {
  const b = resolveBrand(env({ RESTAURANT_NAME: "San Luca Ristorante" }));
  assert.equal(b.name, "San Luca Ristorante");
  assert.equal(b.shortName, "San Luca Ristorante");
});

test("ninguna variable: ambos valen «Restaurante» y nada dice «San Luca»", () => {
  const b = resolveBrand(env({}));
  assert.equal(b.name, "Restaurante");
  assert.equal(b.shortName, "Restaurante");
  assert.ok(!JSON.stringify(b).includes("San Luca"));
});

test("cadenas con espacios alrededor: se recortan con trim()", () => {
  const b = resolveBrand(env({ RESTAURANT_NAME: "  San Luca Ristorante  ", RESTAURANT_SHORT_NAME: "  San Luca  " }));
  assert.equal(b.name, "San Luca Ristorante");
  assert.equal(b.shortName, "San Luca");
});

test("RESTAURANT_NAME vacío se trata como ausente", () => {
  const b = resolveBrand(env({ RESTAURANT_NAME: "", RESTAURANT_SHORT_NAME: "San Luca" }));
  assert.equal(b.name, "Restaurante");
  assert.equal(b.shortName, "Restaurante");
});

test("RESTAURANT_NAME solo espacios se trata como ausente", () => {
  const b = resolveBrand(env({ RESTAURANT_NAME: "   " }));
  assert.equal(b.name, "Restaurante");
  assert.equal(b.shortName, "Restaurante");
});
