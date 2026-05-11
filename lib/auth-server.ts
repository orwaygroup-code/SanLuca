import { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE, type Role } from "./session";
import { prisma } from "./prisma";

export interface ServerSession {
  userId: string;
  role:   Role;
}

/**
 * Lee la sesión del request.
 * - Prioriza cookie firmada (`sl_session`).
 * - Fallback temporal: header `x-user-id` validado contra BD.
 *   Quitar este fallback al terminar la migración (Fase 2 del plan).
 */
export async function getSession(req: NextRequest): Promise<ServerSession | null> {
  // 1) Cookie firmada
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = verifySession(cookie);
  if (payload) {
    return { userId: payload.sub, role: payload.role };
  }

  // 2) Fallback: x-user-id (validado contra BD)
  const userId = req.headers.get("x-user-id");
  if (!userId) return null;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!u) return null;
  return { userId, role: u.role as Role };
}

/** Wrapper para endpoints staff-only. */
export async function requireStaff(req: NextRequest): Promise<ServerSession | null> {
  const s = await getSession(req);
  if (!s) return null;
  return s.role === "ADMIN" || s.role === "HOSTES" ? s : null;
}

/** Wrapper para endpoints admin-only. */
export async function requireAdmin(req: NextRequest): Promise<ServerSession | null> {
  const s = await getSession(req);
  if (!s) return null;
  return s.role === "ADMIN" ? s : null;
}
