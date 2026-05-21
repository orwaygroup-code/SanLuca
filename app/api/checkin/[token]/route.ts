import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { getSession } from "@/lib/auth-server";
import { reEvalUserRule } from "@/lib/tagRules";
import type { ApiResponse } from "@/types";

const RESERVATION_SELECT = {
    id: true,
    guestName: true,
    guestPhone: true,
    date: true,
    guests: true,
    sectionPreference: true,
    occasion: true,
    notes: true,
    status: true,
    paymentStatus: true,
    checkedInAt: true,
    qrToken: true,
    table: {
        select: {
            number: true,
            section: { select: { name: true } },
        },
    },
    user: {
        select: { name: true, email: true, phone: true },
    },
} as const;

// ── GET /api/checkin/[token] ─────────────────────────
// Devuelve los datos de la reserva para el host
export async function GET(
    _req: NextRequest,
    { params }: { params: { token: string } }
) {
    const reservation = await prisma.reservation.findUnique({
        where: { qrToken: params.token },
        select: RESERVATION_SELECT,
    });

    if (!reservation) {
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Reserva no encontrada" },
            { status: 404 }
        );
    }

    return NextResponse.json<ApiResponse>({ success: true, data: reservation });
}

// ── PATCH /api/checkin/[token] ───────────────────────
// Marca la reserva como COMPLETED (check-in realizado). Requiere rol HOSTES.
export async function PATCH(
    req: NextRequest,
    { params }: { params: { token: string } }
) {
    const s = await getSession(req);
    if (!s) {
        return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });
    }
    if (s.role !== "HOSTES") {
        return NextResponse.json<ApiResponse>({ success: false, error: "Solo el personal Hostess puede hacer check-in" }, { status: 403 });
    }

    return runWithSession(s, () => withApp(async (db) => {
        const reservation = await db.reservation.findUnique({
            where: { qrToken: params.token },
            select: { id: true, status: true },
        });

        if (!reservation) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Reserva no encontrada" },
                { status: 404 }
            );
        }

        if (!["PENDING", "CONFIRMED"].includes(reservation.status)) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: `La reserva ya tiene estado: ${reservation.status}` },
                { status: 409 }
            );
        }

        const updated = await db.reservation.update({
            where: { id: reservation.id },
            data: { status: "COMPLETED", checkedInAt: new Date() },
            select: RESERVATION_SELECT,
        });

        // Trigger fire-and-forget: re-evaluar VIP. La reserva recién completada
        // podría ser la #5 del cliente. No await: nunca bloquear el host.
        const ownerId = (await db.reservation.findUnique({
            where:  { id: reservation.id },
            select: { userId: true },
        }))?.userId;
        if (ownerId) {
            reEvalUserRule(ownerId, "VIP").catch((e) =>
                console.error("[AUTO_TAG] reEval VIP failed (checkin):", e),
            );
        }

        return NextResponse.json<ApiResponse>({ success: true, data: updated });
    }));
}
