import { NextRequest } from "next/server";
import { verifyStaffSession, STAFF_SESSION_COOKIE, type StaffRole } from "./staff-session";

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

export async function getStaffSession(req: NextRequest): Promise<StaffServerSession | null> {
  const cookie = req.cookies.get(STAFF_SESSION_COOKIE)?.value;
  const payload = verifyStaffSession(cookie);
  if (!payload) return null;
  return { staffId: payload.sub, role: payload.role, tenantId: payload.tenantId };
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
