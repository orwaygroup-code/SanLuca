// app/api/reservations/available-tables/route.ts
// GET /api/reservations/available-tables?section=Terraza&date=2024-01-15&time=19:00&guests=4
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ADJACENT_PAIRS,
  ADJACENT_TRIPLES,
  ADJACENT_QUADS,
  COMBINED_MAX_CAPACITY,
  TRIPLE_MIN_GUESTS,
  TRIPLE_MAX_CAPACITY,
  QUAD_MIN_GUESTS,
  QUAD_MAX_CAPACITY,
} from "@/lib/tableAdjacency";
import { getReservationWindow, NON_BLOCKING_STATUSES } from "@/lib/tableConflict";
import { tableFitsGuests } from "@/lib/tableCapacity";
import { expirePendingPayments } from "@/lib/expirePendingPayments";
import type { ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
  try {
    await expirePendingPayments();
    const { searchParams } = new URL(request.url);
    const section   = searchParams.get("section");
    const date      = searchParams.get("date");
    const time      = searchParams.get("time");
    const guestsRaw = searchParams.get("guests");

    if (!section || !date || !time || !guestsRaw) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Faltan parámetros: section, date, time, guests" },
        { status: 400 }
      );
    }

    const guests = parseInt(guestsRaw);
    if (isNaN(guests) || guests < 1) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Número de personas inválido (mínimo 1)" },
        { status: 400 }
      );
    }

    const reservationStart = new Date(`${date}T${time}:00.000-06:00`);
    if (isNaN(reservationStart.getTime())) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Fecha u hora inválida" },
        { status: 400 }
      );
    }

    const dbSection = await prisma.section.findFirst({
      where: { name: { equals: section, mode: "insensitive" } },
      include: {
        tables: { where: { isActive: true }, orderBy: { number: "asc" } },
      },
    });

    if (!dbSection) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `Sección "${section}" no encontrada` },
        { status: 404 }
      );
    }

    const tableIds = dbSection.tables.map((t) => t.id);

    // ── Rango del día completo (para bloqueos de grupo grande) ────────────
    // Anclado a -06:00 (hora MX): el VPS corre UTC, así que `new Date(y, mo-1, d)`
    // usaría hora local del servidor (desfase de 6h). Mismo fix que F1 en
    // app/api/reservations/route.ts y la construcción de app/api/admin/map/route.ts.
    const dayStart = new Date(`${date}T00:00:00.000-06:00`);
    const dayEnd   = new Date(`${date}T23:59:59.999-06:00`);

    // ══════════════════════════════════════════════════════════════════════
    // GRUPO GRANDE (>15 personas): verificar disponibilidad de área completa
    // Excepción Privado: ver POST /api/reservations §GRUPO GRANDE. El área
    // es un evento privado por diseño — cualquier número de personas fluye
    // como reserva normal sobre su única mesa.
    // ══════════════════════════════════════════════════════════════════════
    const isPrivado = section.toLowerCase() === "privado";
    if (guests > 15 && !isPrivado) {
      // 1. ¿Ya existe otro grupo grande en esta área ese día?
      const largeGroupConflict = await prisma.reservation.findFirst({
        where: {
          isLargeGroup: true,
          sectionPreference: section,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          date: { gte: dayStart, lte: dayEnd },
        },
      });

      if (largeGroupConflict) {
        return NextResponse.json<ApiResponse>({
          success: true,
          data: {
            isLargeGroup: true,
            hasAvailability: false,
            sectionName: dbSection.name,
            reason: "already_blocked_large_group",
          },
        });
      }

      // 2. ¿Existen reservas normales en alguna mesa de esta área ese día?
      const normalConflict = await prisma.reservation.findFirst({
        where: {
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          date: { gte: dayStart, lte: dayEnd },
          OR: [
            { tableId:        { in: tableIds } },
            { linkedTableId:  { in: tableIds } },
            { thirdTableId:   { in: tableIds } },
            { fourthTableId:  { in: tableIds } },
          ],
        },
      });

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          isLargeGroup: true,
          hasAvailability: !normalConflict,
          sectionName: dbSection.name,
          reason: normalConflict ? "has_normal_reservations" : null,
        },
      });
    }

    // ══════════════════════════════════════════════════════════════════════
    // RESERVA NORMAL (≤15 personas)
    // ══════════════════════════════════════════════════════════════════════

    // Verificar si un grupo grande bloqueó esta área hoy
    const largeGroupBlock = await prisma.reservation.findFirst({
      where: {
        isLargeGroup: true,
        sectionPreference: section,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        date: { gte: dayStart, lte: dayEnd },
      },
    });

    if (largeGroupBlock) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          sectionName: dbSection.name,
          tables: [],
          pairs: [],
          triples: [],
          quads: [],
          hasAvailability: false,
          blockedByLargeGroup: true,
        },
      });
    }

    const { from: winFrom, to: winTo } = getReservationWindow(reservationStart);

    // Reservas activas en la ventana ±3.5h → mesas ocupadas
    const conflicts = await prisma.reservation.findMany({
      where: {
        // Mismo set que findTableConflict (incluye COMPLETED): el mapa de
        // disponibilidad debe coincidir con el check real de conflicto al crear.
        status: { notIn: NON_BLOCKING_STATUSES },
        date:   { gt: winFrom, lt: winTo },
        OR: [
          { tableId:        { in: tableIds } },
          { linkedTableId:  { in: tableIds } },
          { thirdTableId:   { in: tableIds } },
          { fourthTableId:  { in: tableIds } },
        ],
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

    const tables = dbSection.tables.map((t) => ({
      id:       t.id,
      number:   t.number,
      capacity: t.capacity,
      status:   (occupiedIds.has(t.id) ? "occupied" : "available") as "available" | "occupied",
    }));

    const byNumber = new Map(tables.map((t) => [t.number, t]));

    // ── Pares disponibles (5-8 personas) ─────────────────
    type Pair = { tableA: { id: string; number: number }; tableB: { id: string; number: number } };
    const pairs: Pair[] = [];

    if (guests >= 5 && guests <= COMBINED_MAX_CAPACITY) {
      for (const [numA, numB] of ADJACENT_PAIRS) {
        const tA = byNumber.get(numA);
        const tB = byNumber.get(numB);
        if (!tA || !tB) continue;
        if (tA.status === "available" && tB.status === "available") {
          pairs.push({
            tableA: { id: tA.id, number: tA.number },
            tableB: { id: tB.id, number: tB.number },
          });
        }
      }
    }

    // ── Triples disponibles (9-12 personas) ──────────────
    type Triple = { tableA: { id: string; number: number }; tableB: { id: string; number: number }; tableC: { id: string; number: number } };
    const triples: Triple[] = [];

    if (guests >= TRIPLE_MIN_GUESTS && guests <= TRIPLE_MAX_CAPACITY) {
      for (const [numA, numB, numC] of ADJACENT_TRIPLES) {
        const tA = byNumber.get(numA);
        const tB = byNumber.get(numB);
        const tC = byNumber.get(numC);
        if (!tA || !tB || !tC) continue;
        if (tA.status === "available" && tB.status === "available" && tC.status === "available") {
          triples.push({
            tableA: { id: tA.id, number: tA.number },
            tableB: { id: tB.id, number: tB.number },
            tableC: { id: tC.id, number: tC.number },
          });
        }
      }
    }

    // ── Cuádruples disponibles (13-15 personas) ───────────
    type Quad = { tableA: { id: string; number: number }; tableB: { id: string; number: number }; tableC: { id: string; number: number }; tableD: { id: string; number: number } };
    const quads: Quad[] = [];

    if (guests >= QUAD_MIN_GUESTS && guests <= QUAD_MAX_CAPACITY) {
      for (const [numA, numB, numC, numD] of ADJACENT_QUADS) {
        const tA = byNumber.get(numA);
        const tB = byNumber.get(numB);
        const tC = byNumber.get(numC);
        const tD = byNumber.get(numD);
        if (!tA || !tB || !tC || !tD) continue;
        if (tA.status === "available" && tB.status === "available" && tC.status === "available" && tD.status === "available") {
          quads.push({
            tableA: { id: tA.id, number: tA.number },
            tableB: { id: tB.id, number: tB.number },
            tableC: { id: tC.id, number: tC.number },
            tableD: { id: tD.id, number: tD.number },
          });
        }
      }
    }

    const hasAvailability =
      tables.some((t) => t.status === "available" && tableFitsGuests(t.capacity, guests)) ||
      pairs.length > 0 ||
      triples.length > 0 ||
      quads.length > 0;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { sectionName: dbSection.name, tables, pairs, triples, quads, hasAvailability },
    });
  } catch (error) {
    console.error("[API] GET /api/reservations/available-tables error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Error al buscar disponibilidad" },
      { status: 500 }
    );
  }
}
