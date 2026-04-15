// lib/autoAssignTable.ts
// Busca la primera mesa disponible para una fecha/hora/personas dadas.
// Prioriza la sección pedida, luego recorre el resto en orden.

import { prisma } from "@/lib/prisma";
import { getShiftWindow } from "@/lib/shifts";

const SECTION_ORDER = ["Terraza", "Salón", "Planta Alta", "Privado"];

export async function autoAssignTable(
    reservationDate: Date,
    guests: number,
    preferredSection: string | null,
): Promise<{ tableId: string; sectionName: string } | null> {
    const { start: shiftStart, end: shiftEnd } = getShiftWindow(reservationDate);

    // Mesas ya ocupadas en ese turno
    const conflicts = await prisma.reservation.findMany({
        where: {
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            date:   { gte: shiftStart, lt: shiftEnd },
        },
        select: { tableId: true, linkedTableId: true, thirdTableId: true },
    });

    const occupiedIds = new Set<string>();
    for (const c of conflicts) {
        if (c.tableId)       occupiedIds.add(c.tableId);
        if (c.linkedTableId) occupiedIds.add(c.linkedTableId);
        if (c.thirdTableId)  occupiedIds.add(c.thirdTableId);
    }

    // Orden: sección preferida primero
    const order = [...SECTION_ORDER];
    if (preferredSection) {
        const norm = preferredSection.trim();
        const idx  = order.findIndex(s => s.toLowerCase() === norm.toLowerCase());
        if (idx > 0) { order.splice(idx, 1); order.unshift(norm); }
        else if (idx === -1) order.unshift(norm);
    }

    for (const sectionName of order) {
        const section = await prisma.section.findFirst({
            where: { name: { equals: sectionName, mode: "insensitive" } },
            include: {
                tables: {
                    where:   { isActive: true, capacity: { gte: guests } },
                    orderBy: { capacity: "asc" }, // mesa más ajustada primero
                },
            },
        });

        if (!section) continue;

        for (const table of section.tables) {
            if (!occupiedIds.has(table.id)) {
                return { tableId: table.id, sectionName: section.name };
            }
        }
    }

    return null;
}
