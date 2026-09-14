/**
 * Tests de verifyMetaSignature (firma X-Hub-Signature-256 de Meta).
 *   npx tsx --test tests/metaSignature.test.ts
 *
 * Cubre: firma correcta → true; cuerpo alterado → false; header ausente → false;
 * header sin prefijo "sha256=" → false; secreto ausente → false.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";

import { verifyMetaSignature } from "../lib/metaSignature";

const SECRET = "test-app-secret";
const RAW = JSON.stringify({ entry: [{ id: "123", changes: [] }] });

function sign(raw: string, secret = SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
}

test("verifyMetaSignature: firma correcta → true", () => {
  process.env.WHATSAPP_APP_SECRET = SECRET;
  assert.equal(verifyMetaSignature(RAW, sign(RAW)), true);
});

test("verifyMetaSignature: cuerpo alterado → false", () => {
  process.env.WHATSAPP_APP_SECRET = SECRET;
  const header = sign(RAW);
  assert.equal(verifyMetaSignature(RAW + "x", header), false);
});

test("verifyMetaSignature: header ausente → false", () => {
  process.env.WHATSAPP_APP_SECRET = SECRET;
  assert.equal(verifyMetaSignature(RAW, null), false);
});

test('verifyMetaSignature: header sin prefijo "sha256=" → false', () => {
  process.env.WHATSAPP_APP_SECRET = SECRET;
  const bare = createHmac("sha256", SECRET).update(RAW).digest("hex"); // sin "sha256="
  assert.equal(verifyMetaSignature(RAW, bare), false);
});

test("verifyMetaSignature: secreto ausente → false", () => {
  delete process.env.WHATSAPP_APP_SECRET;
  assert.equal(verifyMetaSignature(RAW, sign(RAW)), false);
});
