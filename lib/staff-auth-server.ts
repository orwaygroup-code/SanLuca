import { NextRequest } from "next/server";
import { verifyStaffSession, STAFF_SESSION_COOKIE, type StaffRole } from "./staff-session";
import { prisma } from "./prisma";

/**
 * Guards de request para el realm de Staff (sistema de Comandas).
 * Leen la cookie firmada `sl_staff`. Equivalente a lib/auth-server.ts pero
 * para empleados de operación (WAITER/OPERATION/CAPTAIN/MANAGER).
 */

export interface StaffServerSession {
  staffId:  number;
  role:     StaffRole;
  tenantId: number;
}

/**
 * El ROL y el alta se leen de la base, no de la cookie.
 *
 * La cookie firmada lleva un rol dentro, y antes se devolvía ese valor tal
 * cual. Consecuencia: cambiarle el puesto a alguien en /admin/employees
 * actualizaba la base pero NO sus permisos —seguía operando con el rol que
 * tenía al iniciar sesión— y desactivar a un empleado no revocaba su sesión.
 * La interfaz mostraba el puesto nuevo (porque /api/auth/staff/me sí consulta
 * la base) mientras los permisos seguían siendo los viejos.
 *
 * Ahora la cookie sólo acredita IDENTIDAD (quién) y su firma; el rol y si
 * sigue activo se consultan al vuelo. Es una lectura por clave primaria, y
 * estas rutas ya tocan la base para su trabajo real.
 */
/** Estado autoritativo de un empleado. Aislado para poder sustituirlo en pruebas. */
export type StaffLookup = (
  id: number,
) => Promise<{ id: number; role: StaffRole; active: boolean; tenantId: number } | null>;

const prismaLookup: StaffLookup = (id) =>
  prisma.staff.findUnique({
    where: { id },
    select: { id: true, role: true, active: true, tenantId: true },
  }) as ReturnType<StaffLookup>;

let lookup: StaffLookup = prismaLookup;

/**
 * Sustituye la consulta de empleado. SOLO para pruebas: mantiene la suite de
 * guards sin base de datos, que es lo que la hace correr en milisegundos.
 * Sin argumento, restablece la consulta real.
 */
export function __setStaffLookupForTests(fn?: StaffLookup) {
  lookup = fn ?? prismaLookup;
}

export async function getStaffSession(req: NextRequest): Promise<StaffServerSession | null> {
  const cookie = req.cookies.get(STAFF_SESSION_COOKIE)?.value;
  const payload = verifyStaffSession(cookie);
  if (!payload) return null;

  const staff = await lookup(payload.sub);
  // Dado de baja o borrado → la sesión deja de valer de inmediato.
  if (!staff || !staff.active) return null;

  return { staffId: staff.id, role: staff.role, tenantId: staff.tenantId };
}

/** Cualquier empleado autenticado (cualquier rol de staff). */
export async function requireStaffMember(req: NextRequest): Promise<StaffServerSession | null> {
  return getStaffSession(req);
}

/** Solo MANAGER (Ricardo): CRUD de empleados, configuración del sistema. */
export async function requireManager(req: NextRequest): Promise<StaffServerSession | null> {
  const s = await getStaffSession(req);
  if (!s) return null;
  return s.role === "MANAGER" ? s : null;
}

/** Helper genérico: exige que el rol esté dentro de la lista permitida. */
export async function requireStaffRole(
  req: NextRequest,
  roles: StaffRole[]
): Promise<StaffServerSession | null> {
  const s = await getStaffSession(req);
  if (!s) return null;
  return roles.includes(s.role) ? s : null;
}
