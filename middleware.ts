import { NextRequest, NextResponse } from "next/server";

/**
 * CORS / Origin allowlist para /api/*.
 *
 * Reglas:
 *  - Solo afecta /api/*; el resto pasa sin cambios.
 *  - Sin header Origin: pasa (server-to-server: n8n bot interno, webhooks).
 *  - Origin en lista permitida: agrega headers CORS y deja pasar.
 *  - Origin no permitido: 403.
 *  - OPTIONS preflight: 204 con headers CORS.
 *  - WEBHOOK_PATHS pasan sin chequeo (MercadoPago, Meta WhatsApp, bot n8n).
 */

const ALLOWED_ORIGINS: string[] = [
  "https://sanlucaristorante.com",
  "https://www.sanlucaristorante.com",
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://localhost:3100"]
    : []),
];

const WEBHOOK_PATHS = [
  "/api/payments/webhook",
  "/api/whatsapp/webhook",
  "/api/bot/",
];

function isWebhook(path: string): boolean {
  return WEBHOOK_PATHS.some((p) => path === p || path.startsWith(p));
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin":      origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods":     "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":     "Content-Type, x-bot-key",
    "Access-Control-Max-Age":           "86400",
    Vary: "Origin",
  };
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Webhooks externos / bot: sin origin check
  if (isWebhook(pathname)) return NextResponse.next();

  const origin = req.headers.get("origin");

  // Sin Origin: server-to-server, mismo dominio en SSR, curl, etc.
  if (!origin) return NextResponse.next();

  // Origin no permitido
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new NextResponse("Origin not allowed", { status: 403 });
  }

  const headers = corsHeaders(origin);

  // Preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  // Continuar y adjuntar headers
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
