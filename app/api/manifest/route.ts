// app/api/manifest/route.ts
// Manifest PWA DINÁMICO: el `start_url` viene del parámetro ?start= (la página
// donde el usuario ancla la app). Así, si la ancla desde /staff/operacion, la
// app abre ahí — no en una ruta fija. El componente PwaRegister actualiza el
// <link rel="manifest"> con la ruta actual en cada navegación.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Path de la página que pidió el manifest (mismo origen), vía Referer. */
function refererPath(request: NextRequest): string | null {
  const ref = request.headers.get("referer");
  if (!ref) return null;
  try {
    const u = new URL(ref);
    if (u.origin !== request.nextUrl.origin) return null; // solo mismo origen
    return u.pathname || null;
  } catch {
    return null;
  }
}

export function GET(request: NextRequest) {
  // Prioridad: ?start= explícito (lo pone PwaRegister) → Referer (la página que
  // linkeó el manifest en carga dura) → default. Así el start_url es SIEMPRE la
  // página donde se ancla, aunque Chrome lea el <link> del SSR sin ?start.
  const raw = request.nextUrl.searchParams.get("start") ?? refererPath(request) ?? "/staff/comandas";
  // Solo rutas internas (empieza con "/" y no "//") — evita redirección externa.
  const start_url = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/staff/comandas";

  const manifest = {
    name: "San Luca — Operación",
    short_name: "San Luca",
    description: "Sistema de comandas y operación de San Luca Ristorante.",
    start_url,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1a2224",
    theme_color: "#1a2224",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-store",
    },
  });
}
