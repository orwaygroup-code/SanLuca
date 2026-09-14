/**
 * Tests del canje de un solo uso del token de Google (`gt`).
 *   npx tsx --test tests/google-token.test.ts
 *
 * Cubre consumeGoogleToken: primer canje válido, segundo canje rechazado
 * (un token no se reutiliza), y token vencido rechazado.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";

import { signGoogleToken, consumeGoogleToken } from "../lib/google-token";

// Token válidamente firmado pero YA vencido: replica el formato de signGoogleToken
// (mismo SECRET por defecto) con un exp en el pasado, para probar el rechazo por
// expiración sin tener que esperar los 2 minutos.
function makeExpiredToken(): string {
  const SECRET = process.env.AUTH_SECRET ?? "sanluca-dev-secret";
  const payload = JSON.stringify({
    userId: "u-exp",
    userName: "Vencido",
    userRole: "CUSTOMER",
    exp: Date.now() - 1000,
    nonce: "expirednonce",
  });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

test("consumeGoogleToken: el primer canje válido devuelve el payload", () => {
  const token = signGoogleToken("u1", "Ana", "CUSTOMER");
  const p = consumeGoogleToken(token);
  assert.ok(p);
  assert.equal(p?.userId, "u1");
  assert.equal(p?.userRole, "CUSTOMER");
});

test("consumeGoogleToken: el segundo canje del mismo token se rechaza", () => {
  const token = signGoogleToken("u2", "Beto", "CUSTOMER");
  assert.ok(consumeGoogleToken(token)); // primer canje: ok
  assert.equal(consumeGoogleToken(token), null); // segundo: rechazado
});

test("consumeGoogleToken: un token vencido se rechaza", () => {
  assert.equal(consumeGoogleToken(makeExpiredToken()), null);
});
