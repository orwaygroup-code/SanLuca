/**
 * Tests de la decisión de supervisión dual-realm (sl_session ADMIN vs sl_staff).
 * isSupervisor es pura; no toca DB.
 *   npx tsx --test tests/dualAuth.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { isSupervisor, type DualActor } from "../lib/dualAuth";

const actor = (role: DualActor["role"], realm: DualActor["realm"], staffId: number | null): DualActor =>
  ({ role, realm, staffId, userId: realm === "session" ? "u1" : null });

test("ADMIN (sl_session) es supervisor aunque no tenga staffId vinculado", () => {
  assert.equal(isSupervisor(actor("ADMIN", "session", null)), true);
  assert.equal(isSupervisor(actor("ADMIN", "session", 1)), true);
});

test("CAPTAIN y MANAGER (sl_staff) son supervisores", () => {
  assert.equal(isSupervisor(actor("CAPTAIN", "staff", 5)), true);
  assert.equal(isSupervisor(actor("MANAGER", "staff", 6)), true);
});

test("WAITER y OPERATION NO son supervisores", () => {
  assert.equal(isSupervisor(actor("WAITER", "staff", 7)), false);
  assert.equal(isSupervisor(actor("OPERATION", "staff", 8)), false);
});
