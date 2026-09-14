import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

// Sin esto la ruta sale como `○` estática en `next build`: el randomBytes correría
// una sola vez en build y todos recibirían el MISMO state (cero protección CSRF).
export const dynamic = "force-dynamic";

// Solo rutas internas: se usa para validar el destino post-login antes de guardarlo.
const REDIRECT_RE = /^\/[A-Za-z0-9/_-]*$/;

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Google OAuth no configurado" }, { status: 500 });
  }

  // Destino post-login: ruta interna validada; si no pasa, cae a /reservation.
  const rawRedirect = new URL(request.url).searchParams.get("redirect") || "/reservation";
  const redirect = REDIRECT_RE.test(rawRedirect) ? rawRedirect : "/reservation";

  // state (CSRF): nonce de vida corta que el callback compara contra la cookie.
  const nonce = randomBytes(16).toString("base64url");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", nonce);

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const res = NextResponse.redirect(url.toString());
  res.headers.append("Set-Cookie", `sl_oauth_state=${nonce}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${secure}`);
  res.headers.append("Set-Cookie", `sl_oauth_redirect=${redirect}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${secure}`);
  return res;
}
