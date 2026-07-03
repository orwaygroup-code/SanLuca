// app/api/admin/reservations/[id]/seen/route.ts
// Marca una reserva como "vista" en el panel (apaga el puntito "nueva").
// Idempotente: solo estampa seenAt la primera vez (where seenAt: null).

import { NextRequest, NextResponse } from "next/server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { requireStaff } from "@/lib/auth-server";
import type { ApiResponse } from "@/types";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } },
) {
    try {
        const s = await requireStaff(request);
        if (!s) {
            return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });
        }

        await runWithSession(s, () =>
            withApp((db) =>
                db.reservation.updateMany({
                    where: { id: params.id, seenAt: null },
                    data:  { seenAt: new Date() },
                }),
            ),
        );

        return NextResponse.json<ApiResponse>({ success: true, data: null });
    } catch (error) {
        console.error("[Admin] POST /api/admin/reservations/[id]/seen", error);
        return NextResponse.json<ApiResponse>({ success: false, error: "Error al marcar vista" }, { status: 500 });
    }
}
