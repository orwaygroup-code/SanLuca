// app/api/admin/map/route.ts
// GET  → estado en vivo de todas las mesas (para el mapa del hostess)
// PATCH → bloquear / desbloquear mesa manualmente (walk-in)

import { NextRequest, NextResponse } from "next/server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { requireStaff } from "@/lib/auth-server";
import { closeStaleReservations } from "@/lib/closeStaleReservations";
import type { ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
    try {
        const s = await requireStaff(request);
        if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

        // Auto-cierre lazy: si quedaron walk-ins / reservas de días anteriores
        // sin cerrar manualmente, libera esas mesas antes de calcular el mapa.
        // El cron del VPS también dispara esto a las 00:05 MX; aquí es el respaldo.
        await closeStaleReservations().catch(() => { /* no romper el mapa si falla */ });

        return runWithSession(s, () => withApp(async (db) => {
        const now    = new Date();
        const mxDate = now.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

        // Todo el día en tiempo México
        const dayStart = new Date(`${mxDate}T00:00:00.000-06:00`);
        const dayEnd   = new Date(`${mxDate}T23:59:59.999-06:00`);

        // Grupos grandes activos hoy → bloquean toda su sección
        const largeGroupReservations = await db.reservation.findMany({
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

        // Reservas normales activas hoy con mesa asignada
        const activeReservations = await db.reservation.findMany({
            where: {
                isLargeGroup: false,
                status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "DELAYED"] },
                date:   { gte: dayStart, lte: dayEnd },
                OR: [
                    { tableId:        { not: null } },
                    { linkedTableId:  { not: null } },
                    { thirdTableId:   { not: null } },
                    { fourthTableId:  { not: null } },
                ],
            },
            select: {
                id: true, status: true, guestName: true, guests: true, date: true,
                tableId: true, linkedTableId: true, thirdTableId: true, fourthTableId: true,
            },
        });

        // Bloqueos manuales (walk-in)
        const blocks = await db.tableBlock.findMany({ select: { tableId: true, note: true, createdAt: true } });
        const blockMap = new Map(blocks.map((b) => [b.tableId, b]));

        // Mapear reservas normales a tablas
        type ResInfo = { id: string; status: string; guestName: string; guests: number; time: string };
        const tableResMap = new Map<string, ResInfo>();
        for (const r of activeReservations) {
            const info: ResInfo = {
                id: r.id, status: r.status, guestName: r.guestName, guests: r.guests,
                time: new Date(r.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" }),
            };
            if (r.tableId)        tableResMap.set(r.tableId,        info);
            if (r.linkedTableId)  tableResMap.set(r.linkedTableId,  info);
            if (r.thirdTableId)   tableResMap.set(r.thirdTableId,   info);
            if (r.fourthTableId)  tableResMap.set(r.fourthTableId,  info);
        }

        // Secciones con sus mesas
        const sections = await db.section.findMany({
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
        }));
    } catch (e) {
        console.error("[map GET]", e);
        return NextResponse.json<ApiResponse>({ success: false, error: "Error" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const s = await requireStaff(request);
        if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

        const body = await request.json() as {
            action:     "block" | "unblock" | "block-section" | "unblock-section";
            tableId?:   string;
            sectionId?: string;
            note?:      string;
        };
        const { action, note } = body;

        // Validar action contra el set permitido: una action desconocida NO debe
        // caer al branch individual y ejecutar el deleteMany (desbloqueo accidental).
        const VALID_ACTIONS = ["block", "unblock", "block-section", "unblock-section"] as const;
        if (!action || !VALID_ACTIONS.includes(action)) {
            return NextResponse.json<ApiResponse>({ success: false, error: "Acción inválida" }, { status: 400 });
        }

        return runWithSession(s, () => withApp(async (db) => {
        // ── Bloqueo / liberación de sección completa ──────────────────
        if (action === "block-section" || action === "unblock-section") {
            if (!body.sectionId) return NextResponse.json<ApiResponse>({ success: false, error: "Falta sectionId" }, { status: 400 });

            const section = await db.section.findUnique({
                where:   { id: body.sectionId },
                include: { tables: { where: { isActive: true }, select: { id: true } } },
            });
            if (!section) return NextResponse.json<ApiResponse>({ success: false, error: "Sección no encontrada" }, { status: 404 });

            const tableIds = section.tables.map((t) => t.id);

            if (action === "block-section") {
                await Promise.all(
                    tableIds.map((tid) =>
                        db.tableBlock.upsert({
                            where:  { tableId: tid },
                            update: { note: note ?? "Bloqueo de área", createdAt: new Date() },
                            create: { tableId: tid, note: note ?? "Bloqueo de área" },
                        })
                    )
                );
            } else {
                await db.tableBlock.deleteMany({ where: { tableId: { in: tableIds } } });
            }

            return NextResponse.json<ApiResponse>({ success: true, data: null });
        }

        // ── Bloqueo / liberación de mesa individual ───────────────────
        if (!body.tableId) return NextResponse.json<ApiResponse>({ success: false, error: "Falta tableId" }, { status: 400 });

        if (action === "block") {
            await db.tableBlock.upsert({
                where:  { tableId: body.tableId },
                update: { note: note ?? null, createdAt: new Date() },
                create: { tableId: body.tableId, note: note ?? null },
            });
        } else {
            await db.tableBlock.deleteMany({ where: { tableId: body.tableId } });
        }

        return NextResponse.json<ApiResponse>({ success: true, data: null });
        }));
    } catch (e) {
        console.error("[map PATCH]", e);
        return NextResponse.json<ApiResponse>({ success: false, error: "Error" }, { status: 500 });
    }
}
