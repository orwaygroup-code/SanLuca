import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signGoogleToken } from "@/lib/google-token";

// Solo rutas internas: el destino post-login jamás sale del query, sino de la
// cookie sl_oauth_redirect, y se vuelve a validar aquí.
const REDIRECT_RE = /^\/[A-Za-z0-9/_-]*$/;
// Limpieza de las dos cookies del flujo (Max-Age=0). Se aplica en TODA salida.
const CLEAR_STATE = "sl_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
const CLEAR_REDIRECT = "sl_oauth_redirect=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(/; */)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

// Redirección que SIEMPRE borra las cookies del flujo OAuth.
function redirectClearing(target: string): NextResponse {
  const res = NextResponse.redirect(target);
  res.headers.append("Set-Cookie", CLEAR_STATE);
  res.headers.append("Set-Cookie", CLEAR_REDIRECT);
  return res;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const cookieHeader = request.headers.get("cookie");
  const stateCookie = readCookie(cookieHeader, "sl_oauth_state");
  const redirectCookie = readCookie(cookieHeader, "sl_oauth_redirect") || "/reservation";
  const redirect = REDIRECT_RE.test(redirectCookie) ? redirectCookie : "/reservation";

  if (!code) {
    return redirectClearing(`${appUrl}/login?error=google_cancelled`);
  }
  // CSRF: el state que devuelve Google debe coincidir con la cookie emitida al iniciar.
  if (!state || !stateCookie || state !== stateCookie) {
    return redirectClearing(`${appUrl}/login?error=google_state`);
  }

  try {
    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
        grant_type:    "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("No access_token");

    // 2. Get user profile — exigir correo VERIFICADO por Google.
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    if (profile.verified_email !== true) throw new Error("Correo de Google no verificado");
    const { id: googleId, email, name } = profile as { id: string; email: string; name: string };

    if (!googleId || !email) throw new Error("Perfil incompleto");

    // 3. Find or create. El enlace por email solo aplica a cuentas CUSTOMER: una
    //    cuenta privilegiada (ADMIN/HOSTES) sin googleId NO se enlaza sola por correo.
    let user = await prisma.user.findFirst({ where: { googleId } });
    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail && byEmail.role !== "CUSTOMER") {
        throw Object.assign(new Error("Cuenta privilegiada: usa PIN o contraseña"), { errorCode: "google_privileged" });
      }
      user = byEmail;
    }
    if (!user) {
      user = await prisma.user.create({
        data: { googleId, email, name, phone: "", passwordHash: null },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({ where: { id: user.id }, data: { googleId } });
    }

    // 4. Create signed short-lived token and redirect to login page. El destino
    //    sale de la cookie ya validada, nunca del query.
    const gt = signGoogleToken(user.id, user.name, user.role);
    const loginUrl = new URL("/login", appUrl);
    loginUrl.searchParams.set("gt", gt);
    loginUrl.searchParams.set("redirect", redirect);

    return redirectClearing(loginUrl.toString());
  } catch (e) {
    console.error("[Google OAuth callback]", e);
    const errCode = (e as { errorCode?: string })?.errorCode === "google_privileged" ? "google_privileged" : "google_failed";
    return redirectClearing(`${appUrl}/login?error=${errCode}`);
  }
}
