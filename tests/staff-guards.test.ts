/**
 * Tests de los guards de Staff: acceso a /admin/staff y mutaciones. Sin DB.
 * Se inyecta un NextRequest mínimo (solo req.cookies.get).
 *
 * Ejecutar:
 *   npx tsx --test tests/staff-guards.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";

import { requireManager, getStaffSession, requireStaffRole } from "../lib/staff-auth-server";
import { signStaffSession, STAFF_SESSION_COOKIE, type StaffRole } from "../lib/staff-session";

/** Request mínimo con solo lo que leen los guards: req.cookies.get(name)?.value */
function reqWithStaff(role: StaffRole | null, staffId = 1): NextRequest {
  const cookies: Record<string, string> = role
    ? { [STAFF_SESSION_COOKIE]: signStaffSession({ sub: staffId, role }) }
    : {};
  return {
    cookies: {
      get: (name: string) => (cookies[name] ? { value: cookies[name] } : undefined),
    },
  } as unknown as NextRequest;
}

test("MANAGER pasa requireManager", async () => {
  const s = await requireManager(reqWithStaff("MANAGER", 42));
  assert.ok(s);
  assert.equal(s!.role, "MANAGER");
  assert.equal(s!.staffId, 42);
});

test("WAITER NO puede acceder (requireManager → null → API responde 403)", async () => {
  assert.equal(await requireManager(reqWithStaff("WAITER")), null);
  assert.equal(await requireManager(reqWithStaff("OPERATION")), null);
  assert.equal(await requireManager(reqWithStaff("CAPTAIN")), null);
});

test("sin cookie no hay sesión", async () => {
  assert.equal(await getStaffSession(reqWithStaff(null)), null);
  assert.equal(await requireManager(reqWithStaff(null)), null);
});

test("requireStaffRole respeta la lista permitida", async () => {
  assert.ok(await requireStaffRole(reqWithStaff("CAPTAIN"), ["CAPTAIN", "MANAGER"]));
  assert.equal(await requireStaffRole(reqWithStaff("WAITER"), ["CAPTAIN", "MANAGER"]), null);
});
