import { NextRequest, NextResponse } from "next/server";
import { consumeGoogleToken } from "@/lib/google-token";
import { signSession, sessionCookieString, type Role } from "@/lib/session";

/**
 * POST /api/auth/google/exchange — canjea el token corto `gt` (emitido por el
 * callback de Google) por la cookie de sesión definitiva. Es POST (no GET) para
 * que no baste con hacer que un navegador visite una URL: evita fijación de
 * sesión / login-CSRF y saca el `gt` del query string. Un token solo se canjea
 * UNA vez (consumeGoogleToken).
 */
export async function POST(request: NextRequest) {
  const { token } = await request.json().catch(() => ({} as { token?: string }));
  if (!token || typeof token !== "string") {
    return NextResponse.json({ success: false, error: "Token requerido" }, { status: 400 });
  }

  const payload = consumeGoogleToken(token);
  if (!payload) return NextResponse.json({ success: false, error: "Token inválido o expirado" }, { status: 401 });

  const sessionToken = signSession({ sub: payload.userId, role: (payload.userRole as Role) ?? "CUSTOMER" });
  const res = NextResponse.json({
    success: true,
    data: { userId: payload.userId, userName: payload.userName, userRole: payload.userRole },
  });
  res.headers.set("Set-Cookie", sessionCookieString(sessionToken));
  return res;
}
