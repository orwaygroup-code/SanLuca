import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Sesión firmada HMAC-SHA256 guardada en cookie httpOnly.
 * Payload: { sub: userId, role, iat, exp }. Preparado para sumar tenant_id después.
 */

const SECRET = process.env.AUTH_SECRET ?? "sanluca-dev-secret";
export const SESSION_COOKIE = "sl_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

export type Role = "CUSTOMER" | "HOSTES" | "ADMIN";

export interface SessionPayload {
  sub:  string; // user.id
  role: Role;
  iat:  number; // segundos epoch
  exp:  number; // segundos epoch
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(encoded: string): string {
  return createHmac("sha256", SECRET).update(encoded).digest("base64url");
}

export function signSession(args: { sub: string; role: Role }): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub: args.sub, role: args.role, iat: now, exp: now + SESSION_MAX_AGE };
  const encoded = b64url(Buffer.from(JSON.stringify(payload)));
  // Nonce extra para evitar tokens idénticos cuando re-firmamos en el mismo segundo.
  const nonce = randomBytes(6).toString("base64url");
  const body = `${encoded}.${nonce}`;
  return `${body}.${sign(body)}`;
}

export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encoded, nonce, sig] = parts;
  const expected = sign(`${encoded}.${nonce}`);

  const sigBuf = Buffer.from(sig, "base64url");
  const expBuf = Buffer.from(expected, "base64url");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as SessionPayload;
    if (!payload?.sub || !payload?.role) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Set-Cookie string para respuesta. Secure se activa en producción. */
export function sessionCookieString(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}${secure}`;
}

/** Set-Cookie string para limpiar la sesión. */
export function clearSessionCookieString(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
