// lib/autoAssignTable.ts
// MODO ESTRICTO: Respeta la zona solicitada por el cliente.
// Si la zona pedida no tiene disponibilidad, NO asigna mesa.
// La reserva queda con sectionPreference para asignacion manual.
import { prisma } from "@/lib/prisma";
import { getShiftWindow } from "@/lib/shifts";

const SECTION_ORDER = ["Terraza", "Salón", "Planta Alta", "Privado"];

function normalizeSection(s: string): string {
    return s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

export async function autoAssignTable(
    reservationDate: Date,
    guests: number,
    preferredSection: string | null,
): Promise<{ tableId: string; sectionName: string } | null> {
    const { start: shiftStart, end: shiftEnd } = getShiftWindow(reservationDate);

    const conflicts = await prisma.reservation.findMany({
        where: {
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            date:   { gte: shiftStart, lt: shiftEnd },
        },
        select: { tableId: true, linkedTableId: true, thirdTableId: true, fourthTableId: true },
    });
    const occupiedIds = new Set<string>();
    for (const c of conflicts) {
        if (c.tableId)        occupiedIds.add(c.tableId);
        if (c.linkedTableId)  occupiedIds.add(c.linkedTableId);
        if (c.thirdTableId)   occupiedIds.add(c.thirdTableId);
        if (c.fourthTableId)  occupiedIds.add(c.fourthTableId);
    }

    let sectionsToSearch: string[];
    const isStrict = !!(preferredSection && preferredSection.trim());

    if (isStrict) {
        const normPref = normalizeSection(preferredSection!);
        const officialMatch = SECTION_ORDER.find(s => normalizeSection(s) === normPref);
        sectionsToSearch = officialMatch ? [officialMatch] : [preferredSection!.trim()];
    } else {
        sectionsToSearch = [...SECTION_ORDER];
    }

    for (const sectionName of sectionsToSearch) {
        const section = await prisma.section.findFirst({
            where: { name: { equals: sectionName, mode: "insensitive" } },
            include: {
                tables: {
                    where:   { isActive: true, capacity: { gte: guests } },
                    orderBy: { capacity: "asc" },
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

    if (guests === 8) {
        for (const sectionName of sectionsToSearch) {
            const section = await prisma.section.findFirst({
                where: { name: { equals: sectionName, mode: "insensitive" } },
                include: {
                    tables: {
                        where:   { isActive: true, capacity: 6 },
                        orderBy: { capacity: "asc" },
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
    }

    return null;
}
