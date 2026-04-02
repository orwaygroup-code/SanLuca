import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
    const userId = req.headers.get("x-user-id");
    if (userId) {
        const staff = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (!staff || staff.role !== "HOSTES") {
            return NextResponse.json<ApiResponse>({ success: false, error: "Solo el personal Hostess puede hacer check-in" }, { status: 403 });
        }
    } else {
        return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const reservation = await prisma.reservation.findUnique({
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

    const updated = await prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: "COMPLETED", checkedInAt: new Date() },
        select: RESERVATION_SELECT,
    });

    return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
