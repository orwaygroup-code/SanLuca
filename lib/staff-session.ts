import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Sesión de Staff firmada HMAC-SHA256 en cookie httpOnly `sl_staff`.
 *
 * Realm SEPARADO de la sesión de `User` (`sl_session`, ver lib/session.ts):
 * - `User`  → comensales web + ADMIN/HOSTES (login con email+password).
 * - `Staff` → operación del restaurante (login con PIN de 4 dígitos).
 *
 * Payload: { sub: staff.id, role: StaffRole, tenantId, iat, exp }.
 * Reusa `AUTH_SECRET` pero con un namespace propio en la firma para que un
 * token de un realm nunca valide en el otro.
 */

const SECRET = process.env.AUTH_SECRET ?? "sanluca-dev-secret";
export const STAFF_SESSION_COOKIE = "sl_staff";
export const STAFF_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

export type StaffRole = "WAITER" | "OPERATION" | "CAPTAIN" | "MANAGER";

export interface StaffSessionPayload {
  sub:      number;    // staff.id
  role:     StaffRole;
  tenantId: number;
  iat:      number;    // segundos epoch
  exp:      number;    // segundos epoch
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(encoded: string): string {
  // Namespace "staff" en la firma: aísla este realm del de `User`.
  return createHmac("sha256", SECRET).update(`staff.${encoded}`).digest("base64url");
}

export function signStaffSession(args: { sub: number; role: StaffRole; tenantId?: number }): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: StaffSessionPayload = {
    sub:      args.sub,
    role:     args.role,
    tenantId: args.tenantId ?? 1,
    iat:      now,
    exp:      now + STAFF_SESSION_MAX_AGE,
  };
  const encoded = b64url(Buffer.from(JSON.stringify(payload)));
  const nonce = randomBytes(6).toString("base64url");
  const body = `${encoded}.${nonce}`;
  return `${body}.${sign(body)}`;
}

export function verifyStaffSession(token: string | undefined | null): StaffSessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encoded, nonce, sig] = parts;
  const expected = sign(`${encoded}.${nonce}`);

  const sigBuf = Buffer.from(sig, "base64url");
  const expBuf = Buffer.from(expected, "base64url");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as StaffSessionPayload;
    if (typeof payload?.sub !== "number" || !payload?.role) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Set-Cookie para la sesión de staff. Secure en producción. */
export function staffSessionCookieString(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${STAFF_SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${STAFF_SESSION_MAX_AGE}${secure}`;
}

/** Set-Cookie para limpiar la sesión de staff. */
export function clearStaffSessionCookieString(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${STAFF_SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
