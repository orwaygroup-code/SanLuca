import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ApiResponse } from "@/types";

async function verifyHostes(request: NextRequest) {
    const userId = request.headers.get("x-user-id");
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    return (user?.role as string) === "HOSTES" ? userId : null;
}

// PATCH /api/admin/reservations/[id]
// Body: { status: "CONFIRMED" | "IN_PROGRESS" | "DELAYED" | "CANCELLED" | "COMPLETED" | "NO_SHOW" }
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const adminId = await verifyHostes(request);
        if (!adminId) {
            return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });
        }

        const { status } = await request.json();

        const validStatuses = ["PENDING", "CONFIRMED", "IN_PROGRESS", "DELAYED", "CANCELLED", "COMPLETED", "NO_SHOW"];
        if (!validStatuses.includes(status)) {
            return NextResponse.json<ApiResponse>({ success: false, error: "Estado inválido" }, { status: 400 });
        }

        const extra: Record<string, unknown> = {};
        if (status === "CONFIRMED")   extra.confirmedAt  = new Date();
        if (status === "CANCELLED")   extra.cancelledAt  = new Date();
        if (status === "COMPLETED")   extra.checkedInAt  = new Date();
        if (status === "IN_PROGRESS") extra.checkedInAt  = new Date();

        const reservation = await prisma.reservation.update({
            where: { id: params.id },
            data:  { status, ...extra },
            select: {
                id: true, status: true, guestName: true, date: true,
                guestPhone: true, guests: true, sectionPreference: true,
            },
        });

        return NextResponse.json<ApiResponse>({ success: true, data: reservation });
    } catch (error) {
        console.error("[Admin] PATCH /api/admin/reservations/[id]", error);
        return NextResponse.json<ApiResponse>({ success: false, error: "Error al actualizar reserva" }, { status: 500 });
    }
}
