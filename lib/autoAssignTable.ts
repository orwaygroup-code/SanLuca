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
import { tableFitsGuests } from "@/lib/tableCapacity";

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

// ═══════════════════════════════════════════════════════════════════
// Motor del bot: confirma por disponibilidad, aparta cupo, y la hostess
// finaliza la combinación física. Nunca deja PENDING salvo que NO haya
// cupo suficiente en el área (red de último recurso).
// ═══════════════════════════════════════════════════════════════════

export type BotAssignment = {
    tableIds:    string[];   // 1 mesa (single) o 2–4 (apartadas por cupo)
    sectionName: string;
    provisional: boolean;    // true = mesas apartadas; la hostess finaliza la combinación
} | null;

/**
 * Elige las mesas LIBRES a apartar para cubrir `guests` (pura → testeable).
 * Prefiere mesas de mayor capacidad primero (menos mesas por juntar), máx 4.
 * Devuelve las mesas ordenadas por número, o null si no alcanza en ≤4 mesas.
 */
export function selectHoldTables(
    freeTables: { id: string; number: number; capacity: number }[],
    guests: number,
): { id: string; number: number; capacity: number }[] | null {
    const byCapDesc = [...freeTables].sort((a, b) => b.capacity - a.capacity || a.number - b.number);
    const held: typeof byCapDesc = [];
    let cap = 0;
    for (const t of byCapDesc) {
        held.push(t);
        cap += t.capacity;
        if (cap >= guests) return [...held].sort((a, b) => a.number - b.number);
        if (held.length === 4) break;
    }
    return null;
}

/**
 * Resuelve la asignación del bot:
 *   - { provisional:false, tableIds:[1] }  → cabe en una mesa (o Privado) → asigna.
 *   - { provisional:true,  tableIds:[2–4] } → grupo: aparta mesas por cupo → la hostess finaliza.
 *   - null → no hay cupo en el área → PENDING (red de último recurso).
 * Respeta el modo estricto de sección y la ventana ±3.5h (findOccupiedTableIds).
 */
export async function resolveBotAssignment(
    reservationDate: Date,
    guests: number,
    preferredSection: string | null,
): Promise<BotAssignment> {
    const occupiedIds = await findOccupiedTableIds(prisma, reservationDate);

    let sectionsToSearch: string[];
    const isStrict = !!(preferredSection && preferredSection.trim());
    if (isStrict) {
        const normPref = normalizeSection(preferredSection!);
        const officialMatch = SECTION_ORDER.find((s) => normalizeSection(s) === normPref);
        sectionsToSearch = officialMatch ? [officialMatch] : [preferredSection!.trim()];
    } else {
        sectionsToSearch = [...SECTION_ORDER];
    }

    for (const sectionName of sectionsToSearch) {
        const isPrivado = normalizeSection(sectionName) === "privado";
        const section = await prisma.section.findFirst({
            where: { name: { equals: sectionName, mode: "insensitive" } },
            include: {
                tables: { where: { isActive: true }, orderBy: { number: "asc" } },
            },
        });
        if (!section) continue;

        const freeTables = section.tables.filter((t) => !occupiedIds.has(t.id));
        if (freeTables.length === 0) continue;

        // Privado: mesa única admite cualquier número.
        if (isPrivado) {
            return { tableIds: [freeTables[0].id], sectionName: section.name, provisional: false };
        }

        // 1) Una sola mesa que quepa (número más bajo).
        const single = freeTables.find((t) => tableFitsGuests(t.capacity, guests));
        if (single) {
            return { tableIds: [single.id], sectionName: section.name, provisional: false };
        }

        // 2) Apartar 2–4 mesas por cupo (provisional; la hostess finaliza).
        const held = selectHoldTables(
            freeTables.map((t) => ({ id: t.id, number: t.number, capacity: t.capacity })),
            guests,
        );
        if (held) {
            return { tableIds: held.map((t) => t.id), sectionName: section.name, provisional: true };
        }
    }

    return null;
}
