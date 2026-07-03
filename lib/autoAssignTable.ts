// lib/autoAssignTable.ts
// MODO ESTRICTO: respeta la zona solicitada por el cliente. Si la zona
// pedida no tiene disponibilidad, NO cae a otras secciones — la reserva
// queda con sectionPreference para asignación manual del staff.
//
// Conflicto de mesa: usa lib/tableConflict.ts (ventana ±3.5h, excluye
// COMPLETED/CANCELLED/NO_SHOW).
//
// Excepción Privado: la única mesa del área admite cualquier número de
// personas (no se aplica filtro capacity ≥ guests). Ver
// `01 - Modules/Reservation Engine.md` §Excepción "Privado".

import { prisma } from "@/lib/prisma";
import { findOccupiedTableIds } from "@/lib/tableConflict";

const SECTION_ORDER = ["Terraza", "Salón", "Planta Alta", "Privado"];

/** Lower-case + sin acentos. Permite matchear "Salón" ≡ "salon" ≡ "Salon". */
function normalizeSection(s: string): string {
    return s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
}

export async function autoAssignTable(
    reservationDate: Date,
    guests: number,
    preferredSection: string | null,
): Promise<{ tableId: string; sectionName: string } | null> {
    // Mesas ocupadas en la ventana ±3.5h del slot pedido. Excluye COMPLETED
    // (mesa libre tras turnover natural). Ver lib/tableConflict.ts.
    const occupiedIds = await findOccupiedTableIds(prisma, reservationDate);

    // Modo estricto: si hay preferredSection, SOLO se busca ahí. Si no,
    // recorre el SECTION_ORDER completo como fallback de auto-asignación.
    let sectionsToSearch: string[];
    const isStrict = !!(preferredSection && preferredSection.trim());
    if (isStrict) {
        const normPref = normalizeSection(preferredSection!);
        const officialMatch = SECTION_ORDER.find((s) => normalizeSection(s) === normPref);
        sectionsToSearch = officialMatch ? [officialMatch] : [preferredSection!.trim()];
    } else {
        sectionsToSearch = [...SECTION_ORDER];
    }

    // ── 1ra pasada: capacidad nominal ≥ comensales ─────────────────
    // Excepción Privado: no aplica filtro de capacity — el área entera es
    // el "espacio reservado" y admite cualquier número de personas sobre
    // su mesa única.
    for (const sectionName of sectionsToSearch) {
        const isPrivado = normalizeSection(sectionName) === "privado";
        const section = await prisma.section.findFirst({
            where: { name: { equals: sectionName, mode: "insensitive" } },
            include: {
                tables: {
                    where: {
                        isActive: true,
                        ...(isPrivado ? {} : { capacity: { gte: guests } }),
                    },
                    orderBy: { number: "asc" }, // mesa de número más bajo primero (orden secuencial)
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

    // ── 2da pasada (heurística para grupos de 8) ─────────────────
    // Un grupo de 8 puede caber en una mesa de 6 con sillas extra si no
    // hay opción exacta. Solo se intenta tras agotar la 1ra pasada.
    if (guests === 8) {
        for (const sectionName of sectionsToSearch) {
            const section = await prisma.section.findFirst({
                where: { name: { equals: sectionName, mode: "insensitive" } },
                include: {
                    tables: {
                        where:   { isActive: true, capacity: 6 },
                        orderBy: { number: "asc" },
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
