// app/api/admin/map/route.ts
// GET  → estado en vivo de todas las mesas (para el mapa del hostess)
// PATCH → bloquear / desbloquear mesa manualmente (walk-in)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getShiftWindow } from "@/lib/shifts";
import type { ApiResponse } from "@/types";

async function verifyHostes(request: NextRequest) {
    const userId = request.headers.get("x-user-id");
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    return ["HOSTES", "ADMIN"].includes(user?.role ?? "") ? userId : null;
}

export async function GET(request: NextRequest) {
    try {
        const adminId = await verifyHostes(request);
        if (!adminId) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

        const now = new Date();
        const { start: shiftStart, end: shiftEnd } = getShiftWindow(now);

        // Día completo (para grupos grandes que bloquean todo el día)
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const dayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        // Grupos grandes activos hoy → bloquean toda su sección
        const largeGroupReservations = await prisma.reservation.findMany({
            where: {
                isLargeGroup: true,
                status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "DELAYED"] },
                date:   { gte: dayStart, lte: dayEnd },
                sectionPreference: { not: null },
            },
            select: {
                id: true, status: true, guestName: true, guests: true, date: true,
                sectionPreference: true,
            },
        });

        // Mapa sección → reserva de grupo grande
        type LargeGroupInfo = { id: string; status: string; guestName: string; guests: number; time: string };
        const largeGroupBySectionName = new Map<string, LargeGroupInfo>();
        for (const r of largeGroupReservations) {
            if (r.sectionPreference) {
                largeGroupBySectionName.set(r.sectionPreference, {
                    id: r.id, status: r.status, guestName: r.guestName, guests: r.guests,
                    time: new Date(r.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" }),
                });
            }
        }

        // Reservas normales activas en el turno actual con mesa asignada
        const activeReservations = await prisma.reservation.findMany({
            where: {
                isLargeGroup: false,
                status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "DELAYED"] },
                date:   { gte: shiftStart, lt: shiftEnd },
                OR: [
                    { tableId:       { not: null } },
                    { linkedTableId: { not: null } },
                    { thirdTableId:  { not: null } },
                ],
            },
            select: {
                id: true, status: true, guestName: true, guests: true, date: true,
                tableId: true, linkedTableId: true, thirdTableId: true,
            },
        });

        // Bloqueos manuales (walk-in)
        const blocks = await prisma.tableBlock.findMany({ select: { tableId: true, note: true, createdAt: true } });
        const blockMap = new Map(blocks.map((b) => [b.tableId, b]));

        // Mapear reservas normales a tablas
        type ResInfo = { id: string; status: string; guestName: string; guests: number; time: string };
        const tableResMap = new Map<string, ResInfo>();
        for (const r of activeReservations) {
            const info: ResInfo = {
                id: r.id, status: r.status, guestName: r.guestName, guests: r.guests,
                time: new Date(r.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" }),
            };
            if (r.tableId)       tableResMap.set(r.tableId,       info);
            if (r.linkedTableId) tableResMap.set(r.linkedTableId, info);
            if (r.thirdTableId)  tableResMap.set(r.thirdTableId,  info);
        }

        // Secciones con sus mesas
        const sections = await prisma.section.findMany({
            where:   { isActive: true },
            orderBy: { name: "asc" },
            include: {
                tables: {
                    where:   { isActive: true },
                    orderBy: { number: "asc" },
                },
            },
        });

        const data = sections.map((sec) => {
            const largeGroup = largeGroupBySectionName.get(sec.name) ?? null;

            const tables = sec.tables.map((t) => {
                // Grupo grande tiene prioridad absoluta sobre toda la sección
                if (largeGroup) {
                    return {
                        id: t.id, number: t.number, capacity: t.capacity,
                        status: "area_blocked" as const,
                        reservation: largeGroup,
                        block: null,
                    };
                }

                const res   = tableResMap.get(t.id);
                const block = blockMap.get(t.id);
                const status =
                    res?.status === "IN_PROGRESS" || res?.status === "DELAYED" ? "in_progress"  as const
                    : block                                                      ? "walk_in"      as const
                    : res?.status === "CONFIRMED" || res?.status === "PENDING"  ? "reserved"     as const
                    : "available" as const;

                return {
                    id: t.id, number: t.number, capacity: t.capacity,
                    status,
                    reservation: res ?? null,
                    block: block ? { note: block.note, createdAt: block.createdAt } : null,
                };
            });

            return {
                id:   sec.id,
                name: sec.name,
                largeGroup,   // null o info del grupo grande que bloquea el área
                tables,
            };
        });

        return NextResponse.json<ApiResponse>({ success: true, data });
    } catch (e) {
        console.error("[map GET]", e);
        return NextResponse.json<ApiResponse>({ success: false, error: "Error" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const adminId = await verifyHostes(request);
        if (!adminId) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

        const body = await request.json() as {
            action:     "block" | "unblock" | "block-section" | "unblock-section";
            tableId?:   string;
            sectionId?: string;
            note?:      string;
        };
        const { action, note } = body;

        // ── Bloqueo / liberación de sección completa ──────────────────
        if (action === "block-section" || action === "unblock-section") {
            if (!body.sectionId) return NextResponse.json<ApiResponse>({ success: false, error: "Falta sectionId" }, { status: 400 });

            const section = await prisma.section.findUnique({
                where:   { id: body.sectionId },
                include: { tables: { where: { isActive: true }, select: { id: true } } },
            });
            if (!section) return NextResponse.json<ApiResponse>({ success: false, error: "Sección no encontrada" }, { status: 404 });

            const tableIds = section.tables.map((t) => t.id);

            if (action === "block-section") {
                await Promise.all(
                    tableIds.map((tid) =>
                        prisma.tableBlock.upsert({
                            where:  { tableId: tid },
                            update: { note: note ?? "Bloqueo de área", createdAt: new Date() },
                            create: { tableId: tid, note: note ?? "Bloqueo de área" },
                        })
                    )
                );
            } else {
                await prisma.tableBlock.deleteMany({ where: { tableId: { in: tableIds } } });
            }

            return NextResponse.json<ApiResponse>({ success: true, data: null });
        }

        // ── Bloqueo / liberación de mesa individual ───────────────────
        if (!body.tableId) return NextResponse.json<ApiResponse>({ success: false, error: "Falta tableId" }, { status: 400 });

        if (action === "block") {
            await prisma.tableBlock.upsert({
                where:  { tableId: body.tableId },
                update: { note: note ?? null, createdAt: new Date() },
                create: { tableId: body.tableId, note: note ?? null },
            });
        } else {
            await prisma.tableBlock.deleteMany({ where: { tableId: body.tableId } });
        }

        return NextResponse.json<ApiResponse>({ success: true, data: null });
    } catch (e) {
        console.error("[map PATCH]", e);
        return NextResponse.json<ApiResponse>({ success: false, error: "Error" }, { status: 500 });
    }
}
