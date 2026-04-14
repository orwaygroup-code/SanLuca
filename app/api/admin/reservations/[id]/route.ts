import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReservationQR } from "@/lib/whatsapp";
import type { ApiResponse } from "@/types";

async function verifyHostes(request: NextRequest) {
    const userId = request.headers.get("x-user-id");
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    return ["HOSTES", "ADMIN"].includes(user?.role as string) ? userId : null;
}

// PATCH /api/admin/reservations/[id]
// Body: { status: "CONFIRMED" | ... }          → cambiar estado
// Body: { action: "move-table", tableId, linkedTableId?, thirdTableId?, sectionPreference? } → mover mesa
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const adminId = await verifyHostes(request);
        if (!adminId) {
            return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });
        }

        const body = await request.json();

        // ── Mover mesa ────────────────────────────────────────────────
        if (body.action === "move-table") {
            const { tableId, linkedTableId, thirdTableId, sectionPreference } = body as {
                tableId:           string;
                linkedTableId?:    string;
                thirdTableId?:     string;
                sectionPreference?: string;
            };

            if (!tableId) {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: "Se requiere tableId para mover la mesa" },
                    { status: 400 }
                );
            }

            // Obtener la reserva actual para saber fecha/hora y excluirla del check de conflictos
            const current = await prisma.reservation.findUnique({
                where: { id: params.id },
                select: { id: true, date: true, status: true },
            });

            if (!current) {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: "Reserva no encontrada" },
                    { status: 404 }
                );
            }

            const { getShiftWindow } = await import("@/lib/shifts");
            const { start: shiftStart, end: shiftEnd } = getShiftWindow(current.date);

            const allNewIds = [tableId, linkedTableId, thirdTableId].filter(Boolean) as string[];

            // Verificar conflictos en la nueva mesa (excluyendo esta misma reserva)
            const conflict = await prisma.reservation.findFirst({
                where: {
                    id:     { not: params.id },
                    status: { notIn: ["CANCELLED", "NO_SHOW"] },
                    date:   { gte: shiftStart, lt: shiftEnd },
                    OR: allNewIds.flatMap((id) => [
                        { tableId: id },
                        { linkedTableId: id },
                        { thirdTableId: id },
                    ]),
                },
            });

            if (conflict) {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: "La mesa seleccionada ya está ocupada en ese turno." },
                    { status: 409 }
                );
            }

            const updated = await prisma.reservation.update({
                where: { id: params.id },
                data: {
                    tableId,
                    linkedTableId:     linkedTableId  ?? null,
                    thirdTableId:      thirdTableId   ?? null,
                    ...(sectionPreference ? { sectionPreference } : {}),
                },
                select: {
                    id: true, status: true, guestName: true, date: true,
                    guestPhone: true, guests: true, sectionPreference: true, qrToken: true,
                    table: { select: { number: true, section: { select: { name: true } } } },
                },
            });

            return NextResponse.json<ApiResponse>({ success: true, data: updated });
        }

        // ── Cambiar estado ────────────────────────────────────────────
        const { status } = body;

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
                guestPhone: true, guests: true, sectionPreference: true, qrToken: true,
            },
        });

        // Enviar QR por WhatsApp al confirmar
        if (status === "CONFIRMED") {
            sendReservationQR({
                phone:             reservation.guestPhone,
                guestName:         reservation.guestName,
                date:              new Date(reservation.date),
                guests:            reservation.guests,
                sectionPreference: reservation.sectionPreference,
                qrToken:           reservation.qrToken,
            }).catch((e) => console.error("[WhatsApp QR]", e));
        }

        return NextResponse.json<ApiResponse>({ success: true, data: reservation });
    } catch (error) {
        console.error("[Admin] PATCH /api/admin/reservations/[id]", error);
        return NextResponse.json<ApiResponse>({ success: false, error: "Error al actualizar reserva" }, { status: 500 });
    }
}

// DELETE /api/admin/reservations/[id]
// Solo elimina reservas en estado terminal (CANCELLED, NO_SHOW, COMPLETED)
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const adminId = await verifyHostes(request);
        if (!adminId) {
            return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });
        }

        const reservation = await prisma.reservation.findUnique({
            where: { id: params.id },
            select: { status: true },
        });

        if (!reservation) {
            return NextResponse.json<ApiResponse>({ success: false, error: "Reserva no encontrada" }, { status: 404 });
        }

        const deletable = ["CANCELLED", "NO_SHOW", "COMPLETED"];
        if (!deletable.includes(reservation.status)) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Solo se pueden eliminar reservas canceladas, no presentadas o completadas" },
                { status: 400 }
            );
        }

        await prisma.reservation.delete({ where: { id: params.id } });

        return NextResponse.json<ApiResponse>({ success: true, data: { id: params.id } });
    } catch (error) {
        console.error("[Admin] DELETE /api/admin/reservations/[id]", error);
        return NextResponse.json<ApiResponse>({ success: false, error: "Error al eliminar reserva" }, { status: 500 });
    }
}
