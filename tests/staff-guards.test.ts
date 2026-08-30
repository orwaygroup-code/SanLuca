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

import { requireManager, getStaffSession, requireStaffRole, __setStaffLookupForTests } from "../lib/staff-auth-server";
import { signStaffSession, STAFF_SESSION_COOKIE, type StaffRole } from "../lib/staff-session";

// El rol y el alta se leen de la BD, no de la cookie: así cambiar el puesto de
// alguien surte efecto de inmediato y dar de baja revoca su sesión. Aquí se
// sustituye esa consulta para conservar la suite sin base de datos.
const empleados = new Map<number, { role: StaffRole; active: boolean }>();
__setStaffLookupForTests(async (id) => {
  const e = empleados.get(id);
  return e ? { id, role: e.role, active: e.active, tenantId: 1 } : null;
});

/** Request mínimo con solo lo que leen los guards: req.cookies.get(name)?.value */
function reqWithStaff(role: StaffRole | null, staffId = 1): NextRequest {
  const cookies: Record<string, string> = role
    ? { [STAFF_SESSION_COOKIE]: signStaffSession({ sub: staffId, role }) }
    : {};
  if (role) empleados.set(staffId, { role, active: true });
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

// ── Rol y alta autoritativos ────────────────────────────────────────
// Regresión: el rol se leía de la cookie firmada, así que cambiar el puesto de
// alguien no alteraba sus permisos hasta que cerrara sesión, y dar de baja a un
// empleado no revocaba la suya.

test("cambiar el puesto surte efecto sin cerrar sesión", async () => {
  // Inició sesión siendo WAITER: su cookie lo dice.
  const req = reqWithStaff("WAITER", 77);
  assert.equal(await requireManager(req), null);

  // Lo promueven a MANAGER en la base, con la MISMA cookie.
  empleados.set(77, { role: "MANAGER", active: true });
  const s = await requireManager(req);
  assert.ok(s);
  assert.equal(s!.role, "MANAGER");
});

test("degradar a alguien le quita los permisos de inmediato", async () => {
  const req = reqWithStaff("MANAGER", 78);
  assert.ok(await requireManager(req));

  empleados.set(78, { role: "WAITER", active: true });
  assert.equal(await requireManager(req), null);
});

test("dar de baja revoca la sesión aunque la cookie siga firmada", async () => {
  const req = reqWithStaff("MANAGER", 79);
  assert.ok(await getStaffSession(req));

  empleados.set(79, { role: "MANAGER", active: false });
  assert.equal(await getStaffSession(req), null);
  assert.equal(await requireManager(req), null);
});
