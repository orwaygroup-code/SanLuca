import { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE, type Role } from "./session";

export interface ServerSession {
  userId: string;
  role:   Role;
}

/**
 * Lee la sesión del request desde la cookie firmada `sl_session`.
 * El fallback a `x-user-id` se eliminó al terminar la Fase 2 del plan de seguridad.
 */
export async function getSession(req: NextRequest): Promise<ServerSession | null> {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = verifySession(cookie);
  if (!payload) return null;
  return { userId: payload.sub, role: payload.role };
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
