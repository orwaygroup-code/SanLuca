import { NextRequest, NextResponse } from "next/server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { sendReservationQR } from "@/lib/whatsapp";
import { resolveEditTables } from "@/lib/reservationTables";
import { combinedCapacity, evaluateCapacity } from "@/lib/tableCapacity";
import { requireStaff } from "@/lib/auth-server";
import { reEvalUserRule } from "@/lib/tagRules";
import type { ApiResponse } from "@/types";

// PATCH /api/admin/reservations/[id]
// Body: { status: "CONFIRMED" | ... }          → cambiar estado
// Body: { action: "move-table", tableId, linkedTableId?, thirdTableId?, sectionPreference? } → mover mesa
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const s = await requireStaff(request);
        if (!s) {
            return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });
        }

        const body = await request.json();

        return runWithSession(s, () => withApp(async (db) => {

        // ── Editar reserva completa ───────────────────────────────────
        if (body.action === "edit-reservation") {
            const {
                date, time, guests, guestName, guestPhone,
                sectionPreference, tableId, linkedTableId, thirdTableId, fourthTableId,
                notes, occasion,
            } = body as {
                date:               string;
                time:               string;
                guests:             number;
                guestName:          string;
                guestPhone:         string;
                sectionPreference?: string;
                tableId?:           string;
                linkedTableId?:     string;
                thirdTableId?:      string;
                fourthTableId?:     string;
                notes?:             string;
                occasion?:          string;
            };

            const reservationDate = new Date(`${date}T${time}:00.000-06:00`);
            if (isNaN(reservationDate.getTime())) {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: "Fecha u hora inválida" }, { status: 400 }
                );
            }

            const { getShiftWindow } = await import("@/lib/shifts");
            const { start: shiftStart, end: shiftEnd } = getShiftWindow(reservationDate);

            // Mesa actual de la reserva — se PRESERVA si la edición no manda una
            // mesa explícita. Editar NO mueve la mesa (eso es "Cambiar Mesa").
            const currentRes = await db.reservation.findUnique({
                where: { id: params.id },
                select: { tableId: true, linkedTableId: true, thirdTableId: true, fourthTableId: true },
            });
            if (!currentRes) {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: "Reserva no encontrada" }, { status: 404 }
                );
            }

            const finalTables = resolveEditTables(
                { tableId, linkedTableId, thirdTableId, fourthTableId },
                currentRes,
            );

            // Solo verificar conflicto si la edición trae una mesa NUEVA explícita.
            // (Preservar la mesa actual nunca puede chocar consigo misma.)
            if (tableId) {
                const allIds = [
                    finalTables.tableId, finalTables.linkedTableId,
                    finalTables.thirdTableId, finalTables.fourthTableId,
                ].filter(Boolean) as string[];
                const conflict = await db.reservation.findFirst({
                    where: {
                        id:     { not: params.id },
                        status: { notIn: ["CANCELLED", "NO_SHOW"] },
                        date:   { gte: shiftStart, lt: shiftEnd },
                        OR: allIds.flatMap((id) => [
                            { tableId: id }, { linkedTableId: id }, { thirdTableId: id }, { fourthTableId: id },
                        ]),
                    },
                });
                if (conflict) {
                    return NextResponse.json<ApiResponse>(
                        { success: false, error: "La mesa seleccionada ya está ocupada en ese turno." },
                        { status: 409 }
                    );
                }
            }

            const updated = await db.reservation.update({
                where: { id: params.id },
                data: {
                    date:              reservationDate,
                    guests,
                    guestName,
                    guestPhone,
                    sectionPreference: sectionPreference ?? null,
                    tableId:           finalTables.tableId,
                    linkedTableId:     finalTables.linkedTableId,
                    thirdTableId:      finalTables.thirdTableId,
                    fourthTableId:     finalTables.fourthTableId,
                    notes:             notes    ?? null,
                    occasion:          occasion ?? null,
                },
                select: {
                    id: true, status: true, guestName: true, date: true,
                    guestPhone: true, guests: true, sectionPreference: true, qrToken: true,
                    table: { select: { number: true, section: { select: { name: true } } } },
                },
            });

            return NextResponse.json<ApiResponse>({ success: true, data: updated });
        }

        // ── Mover mesa ────────────────────────────────────────────────
        if (body.action === "move-table") {
            const { tableId, linkedTableId, thirdTableId, fourthTableId, sectionPreference, forceAssign } = body as {
                tableId:            string;
                linkedTableId?:     string;
                thirdTableId?:      string;
                fourthTableId?:     string;
                sectionPreference?: string;
                forceAssign?:       boolean;
            };

            // Sin tableId → solo actualizar sección (grupo grande)
            if (!tableId) {
                const updated = await db.reservation.update({
                    where: { id: params.id },
                    data: {
                        tableId:       null,
                        linkedTableId: null,
                        thirdTableId:  null,
                        fourthTableId: null,
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

            // Obtener la reserva actual para saber fecha/hora/comensales y excluirla del check
            const current = await db.reservation.findUnique({
                where: { id: params.id },
                select: { id: true, date: true, status: true, guests: true },
            });

            if (!current) {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: "Reserva no encontrada" },
                    { status: 404 }
                );
            }

            const { getShiftWindow } = await import("@/lib/shifts");
            const { start: shiftStart, end: shiftEnd } = getShiftWindow(current.date);

            const allNewIds = [tableId, linkedTableId, thirdTableId, fourthTableId].filter(Boolean) as string[];

            // Verificar conflictos en la nueva mesa (excluyendo esta misma reserva)
            const conflict = await db.reservation.findFirst({
                where: {
                    id:     { not: params.id },
                    status: { notIn: ["CANCELLED", "NO_SHOW"] },
                    date:   { gte: shiftStart, lt: shiftEnd },
                    OR: allNewIds.flatMap((id) => [
                        { tableId: id },
                        { linkedTableId: id },
                        { thirdTableId: id },
                        { fourthTableId: id },
                    ]),
                },
            });

            if (conflict) {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: "La mesa seleccionada ya está ocupada en ese turno." },
                    { status: 409 }
                );
            }

            // ── Validación de capacidad (con override) ───────────────────
            // La(s) mesa(s) elegida(s) deben cubrir a los comensales. Si no
            // cubren y NO se forzó, se bloquea con error claro. Si se forzó
            // (forceAssign), se permite y se registra en bitácora de auditoría.
            const chosenTables = await db.table.findMany({
                where:  { id: { in: allNewIds } },
                select: { capacity: true },
            });
            const totalCapacity = combinedCapacity(chosenTables.map((t) => t.capacity));
            const decision = evaluateCapacity(totalCapacity, current.guests, forceAssign === true);
            if (!decision.ok) {
                return NextResponse.json<ApiResponse>(
                    {
                        success: false,
                        error: `La mesa seleccionada es para ${totalCapacity} personas y vas a sentar ${current.guests}. Confirma para continuar.`,
                    },
                    { status: 409 }
                );
            }
            if (decision.requiresOverride) {
                // Bitácora de auditoría: override de capacidad ejecutado por staff.
                console.warn("[AUDIT] capacity-override move-table", {
                    staffUserId:   s.userId,
                    reservationId: params.id,
                    tableIds:      allNewIds,
                    totalCapacity,
                    guests:        current.guests,
                });
            }

            const updated = await db.reservation.update({
                where: { id: params.id },
                data: {
                    tableId,
                    linkedTableId:  linkedTableId  ?? null,
                    thirdTableId:   thirdTableId   ?? null,
                    fourthTableId:  fourthTableId  ?? null,
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

        const reservation = await db.reservation.update({
            where: { id: params.id },
            data:  { status, ...extra },
            select: {
                id: true, status: true, userId: true, guestName: true, date: true,
                guestPhone: true, guests: true, sectionPreference: true, qrToken: true,
            },
        });

        // Trigger fire-and-forget: re-evaluar VIP cuando el admin marca COMPLETED.
        if (status === "COMPLETED" && reservation.userId) {
            reEvalUserRule(reservation.userId, "VIP").catch((e) =>
                console.error("[AUTO_TAG] reEval VIP failed (admin status):", e),
            );
        }

        // Si se cancela una reserva pagada, generar crédito a favor del cliente
        if (status === "CANCELLED") {
            const { createCreditFromCancelledReservation } = await import("@/lib/credits");
            await createCreditFromCancelledReservation(params.id).catch((e) =>
                console.error("[Credits] error generating credit:", e)
            );
        }

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
        }));
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
        const s = await requireStaff(request);
        if (!s) {
            return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });
        }

        return runWithSession(s, () => withApp(async (db) => {
            const reservation = await db.reservation.findUnique({
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

            await db.reservation.delete({ where: { id: params.id } });

            return NextResponse.json<ApiResponse>({ success: true, data: { id: params.id } });
        }));
    } catch (error) {
        console.error("[Admin] DELETE /api/admin/reservations/[id]", error);
        return NextResponse.json<ApiResponse>({ success: false, error: "Error al eliminar reserva" }, { status: 500 });
    }
}
