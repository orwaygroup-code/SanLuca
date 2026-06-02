/**
 * Tests de la sesión de Staff (cookie sl_staff). Sin DB.
 *
 * Ejecutar:
 *   npx tsx --test tests/staff-session.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { signStaffSession, verifyStaffSession } from "../lib/staff-session";
import { signSession, verifySession } from "../lib/session";

test("round-trip: firma y verifica conservando sub/role/tenant", () => {
  const token = signStaffSession({ sub: 7, role: "MANAGER", tenantId: 1 });
  const payload = verifyStaffSession(token);
  assert.ok(payload);
  assert.equal(payload!.sub, 7);
  assert.equal(payload!.role, "MANAGER");
  assert.equal(payload!.tenantId, 1);
  assert.ok(payload!.exp > payload!.iat);
});

test("rechaza token manipulado o vacío", () => {
  const token = signStaffSession({ sub: 1, role: "WAITER" });
  assert.equal(verifyStaffSession(token + "x"), null);
  assert.equal(verifyStaffSession("a.b.c"), null);
  assert.equal(verifyStaffSession(""), null);
  assert.equal(verifyStaffSession(undefined), null);
});

test("aislamiento de realms: token de User NO valida como Staff y viceversa", () => {
  // Token del realm User (lib/session) no debe pasar como Staff.
  const userToken = signSession({ sub: "cuid-user-1", role: "ADMIN" });
  assert.equal(verifyStaffSession(userToken), null);

  // Token de Staff no debe pasar como User.
  const staffToken = signStaffSession({ sub: 1, role: "MANAGER" });
  assert.equal(verifySession(staffToken), null);
});
