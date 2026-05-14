// app/api/admin/jobs/close-day/route.ts
// Cierra automáticamente reservas de días anteriores que quedaron colgadas
// (IN_PROGRESS, DELAYED, PENDING/CONFIRMED sin check-in). Se llama vía cron
// desde el VPS con header x-bot-key a las 00:05 hora México.
//
// El mismo helper se ejecuta lazy desde GET /api/admin/map cuando el hostess
// abre el mapa, como respaldo por si el cron falla.

import { NextRequest, NextResponse } from "next/server";
import { closeStaleReservations } from "@/lib/closeStaleReservations";

export async function POST(req: NextRequest) {
    const key = req.headers.get("x-bot-key");
    if (!key || key !== process.env.BOT_API_KEY) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { completed, noShow } = await closeStaleReservations();

    return NextResponse.json({
        success: true,
        completed,
        noShow,
    });
}
