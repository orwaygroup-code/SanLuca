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

        // Reservas activas en el turno actual con mesa asignada
        const activeReservations = await prisma.reservation.findMany({
            where: {
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

        // Mapear reservas a tablas
        type ResInfo = { id: string; status: string; guestName: string; guests: number; time: string };
        const tableResMap = new Map<string, ResInfo>();
        for (const r of activeReservations) {
            const info: ResInfo = { id: r.id, status: r.status, guestName: r.guestName, guests: r.guests, time: new Date(r.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) };
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

        const data = sections.map((sec) => ({
            id:   sec.id,
            name: sec.name,
            tables: sec.tables.map((t) => {
                const res   = tableResMap.get(t.id);
                const block = blockMap.get(t.id);
                const status =
                    res?.status === "IN_PROGRESS" || res?.status === "DELAYED" ? "in_progress"
                    : block                                                      ? "walk_in"
                    : res?.status === "CONFIRMED" || res?.status === "PENDING"  ? "reserved"
                    : "available";
                return {
                    id: t.id, number: t.number, capacity: t.capacity,
                    status,
                    reservation: res ?? null,
                    block:       block ? { note: block.note, createdAt: block.createdAt } : null,
                };
            }),
        }));

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

        const { tableId, action, note } = await request.json() as { tableId: string; action: "block" | "unblock"; note?: string };

        if (!tableId || !action) {
            return NextResponse.json<ApiResponse>({ success: false, error: "Faltan tableId y action" }, { status: 400 });
        }

        if (action === "block") {
            await prisma.tableBlock.upsert({
                where:  { tableId },
                update: { note: note ?? null, createdAt: new Date() },
                create: { tableId, note: note ?? null },
            });
        } else {
            await prisma.tableBlock.deleteMany({ where: { tableId } });
        }

        return NextResponse.json<ApiResponse>({ success: true, data: null });
    } catch (e) {
        console.error("[map PATCH]", e);
        return NextResponse.json<ApiResponse>({ success: false, error: "Error" }, { status: 500 });
    }
}
