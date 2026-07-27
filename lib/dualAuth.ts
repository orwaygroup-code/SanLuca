import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { getSession } from "./auth-server";          // realm sl_session (User: ADMIN/HOSTES/CUSTOMER)
import { getStaffSession } from "./staff-auth-server"; // realm sl_staff (Staff con PIN)
import { isCaptainOrManager } from "./comandaRules";
import type { StaffRole } from "./staff-session";

/**
 * Auth DUAL-REALM (Fase B.2). Ricardo (MANAGER) migró a sl_session (ADMIN,
 * email/password); Perla/Capitán/Meseros siguen en sl_staff (PIN). Algunas
 * acciones (toggle IVA, intervención de comandas) deben aceptar ambos realms.
 *
 * Para auditoría se normaliza un `staffId` (Int): en sl_staff es el del PIN;
 * en sl_session es el `User.staffId` vinculado (Ricardo). Un ADMIN sin Staff
 * vinculado tiene `staffId = null` → las acciones que escriben auditoría con
 * FK obligatoria lo rechazan con mensaje claro.
 */

export interface DualActor {
  realm:   "session" | "staff";
  role:    StaffRole | "ADMIN";
  staffId: number | null; // para auditoría
  userId:  string | null;
}

/** Resuelve el actor: cualquier Staff (sl_staff) o ADMIN (sl_session). null si ninguno. */
export async function resolveActor(req: NextRequest): Promise<DualActor | null> {
  const staff = await getStaffSession(req);
  if (staff) return { realm: "staff", role: staff.role, staffId: staff.staffId, userId: null };

  const sess = await getSession(req);
  if (sess && sess.role === "ADMIN") {
    const u = await prisma.user.findUnique({ where: { id: sess.userId }, select: { staffId: true } });
    return { realm: "session", role: "ADMIN", staffId: u?.staffId ?? null, userId: sess.userId };
  }
  return null;
}

/** ¿El actor puede intervenir comandas (CAPTAIN/MANAGER staff, o ADMIN)? */
export function isSupervisor(actor: DualActor): boolean {
  return actor.role === "ADMIN" || isCaptainOrManager(actor.role as StaffRole);
}

/** ADMIN (sl_session) O MANAGER (sl_staff). Para PATCH /api/admin/settings. */
export async function requireAdminOrStaffManager(req: NextRequest): Promise<DualActor | null> {
  const a = await resolveActor(req);
  if (!a) return null;
  return a.role === "ADMIN" || a.role === "MANAGER" ? a : null;
}

/** ADMIN (sl_session) O CAPTAIN/MANAGER (sl_staff). Para intervención de comandas. */
export async function requireComandaSupervisor(req: NextRequest): Promise<DualActor | null> {
  const a = await resolveActor(req);
  if (!a) return null;
  return isSupervisor(a) ? a : null;
}

/**
 * CAJA: OPERATION/CAPTAIN/MANAGER (sl_staff) o ADMIN (sl_session), con `staffId`
 * NO nulo (los registros de caja llevan FK obligatoria a Staff). WAITER excluido.
 * Para turno, cobro y estado de caja.
 */
export async function requireCashier(req: NextRequest): Promise<DualActor | null> {
  const a = await resolveActor(req);
  if (!a) return null;
  const ok = a.role === "ADMIN" || a.role === "OPERATION" || isCaptainOrManager(a.role as StaffRole);
  return ok && a.staffId != null ? a : null;
}

/**
 * Solo ADMIN del realm sl_session (Ricardo). Para el panel /admin/* migrado
 * (CRUD empleados, reportes, settings). Devuelve su `staffId` vinculado para
 * auditoría (createdById, etc.). NO usa resolveActor para no confundirse si
 * Ricardo también tiene cookie sl_staff.
 */
export async function requireAdminSession(
  req: NextRequest,
): Promise<{ userId: string; staffId: number | null } | null> {
  const sess = await getSession(req);
  if (!sess || sess.role !== "ADMIN") return null;
  const u = await prisma.user.findUnique({ where: { id: sess.userId }, select: { staffId: true } });
  return { userId: sess.userId, staffId: u?.staffId ?? null };
}
