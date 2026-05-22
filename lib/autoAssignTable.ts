// lib/autoAssignTable.ts
// Busca la primera mesa disponible para una fecha/hora/personas dadas.
// Prioriza la sección pedida, luego recorre el resto en orden.

import { prisma } from "@/lib/prisma";
import { findOccupiedTableIds } from "@/lib/tableConflict";

const SECTION_ORDER = ["Terraza", "Salón", "Planta Alta", "Privado"];

export async function autoAssignTable(
    reservationDate: Date,
    guests: number,
    preferredSection: string | null,
): Promise<{ tableId: string; sectionName: string } | null> {
    // Mesas ocupadas en la ventana ±4h del slot pedido. Excluye COMPLETED
    // (mesa libre tras turnover natural). Ver lib/tableConflict.ts.
    const occupiedIds = await findOccupiedTableIds(prisma, reservationDate);

    // Orden: sección preferida primero
    const order = [...SECTION_ORDER];
    if (preferredSection) {
        const norm = preferredSection.trim();
        const idx  = order.findIndex(s => s.toLowerCase() === norm.toLowerCase());
        if (idx > 0) { order.splice(idx, 1); order.unshift(norm); }
        else if (idx === -1) order.unshift(norm);
    }

    // ── 1ra pasada: capacidad nominal ≥ comensales ─────────────────
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

    // ── 2da pasada: regla especial — mesas de 6 admiten 8 personas ──
    if (guests === 8) {
        for (const sectionName of order) {
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
