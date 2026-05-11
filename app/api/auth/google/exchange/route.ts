import { NextRequest, NextResponse } from "next/server";
import { verifyGoogleToken } from "@/lib/google-token";
import { signSession, sessionCookieString, type Role } from "@/lib/session";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ success: false, error: "Token requerido" }, { status: 400 });

  const payload = verifyGoogleToken(token);
  if (!payload) return NextResponse.json({ success: false, error: "Token inválido o expirado" }, { status: 401 });

  const sessionToken = signSession({ sub: payload.userId, role: (payload.userRole as Role) ?? "CUSTOMER" });
  const res = NextResponse.json({ success: true, data: payload });
  res.headers.set("Set-Cookie", sessionCookieString(sessionToken));
  return res;
}
