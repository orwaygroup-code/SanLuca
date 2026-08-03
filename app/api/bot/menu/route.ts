// app/api/bot/menu/route.ts
// Menú COMPACTO para el bot: solo id + nombre + precio, agrupado por turno/categoría.
// Fuente de verdad = la BD (solo platillos available + active → refleja al instante
// deshabilitados/agotados). Incluye un "sello de versión" (hash del menú): el bot
// pide `?version=1` (barato) y solo recarga/inyecta el menú completo cuando el sello
// cambió → contexto fresco sin quemar tokens. Requiere header x-bot-key.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import type { ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
  const botKey = request.headers.get("x-bot-key");
  if (!botKey || botKey !== process.env.BOT_API_KEY) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const cats = await prisma.menuCategory.findMany({
    orderBy: { position: "asc" },
    select: {
      name: true,
      carta: { select: { turno: true } },
      dishes: {
        where: { available: true, active: true },
        orderBy: { position: "asc" },
        select: { id: true, name: true, price: true },
      },
    },
  });

  const menu = cats
    .filter((c) => c.dishes.length > 0)
    .map((c) => ({
      turno: c.carta?.turno ?? null, // "COMIDA" | "BRUNCH" | null
      categoria: c.name,
      platillos: c.dishes.map((d) => ({ id: d.id, nombre: d.name, precio: Number(d.price) })),
    }));

  // Sello: hash del menú compacto. Cambia si se modifica id/nombre/precio o la
  // disponibilidad/activo de cualquier platillo → sirve para invalidar el cache del bot.
  const version = createHash("sha1").update(JSON.stringify(menu)).digest("hex").slice(0, 12);

  // ?version=1 → solo el sello (chequeo barato, sin traer todo el menú).
  if (new URL(request.url).searchParams.get("version") === "1") {
    return NextResponse.json<ApiResponse>({ success: true, data: { version } });
  }
  return NextResponse.json<ApiResponse>({ success: true, data: { version, menu } });
}
