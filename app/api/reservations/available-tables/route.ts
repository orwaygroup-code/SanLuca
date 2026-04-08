// app/api/reservations/available-tables/route.ts
// GET /api/reservations/available-tables?section=Terraza&date=2024-01-15&time=19:00&guests=4
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ADJACENT_PAIRS,
  ADJACENT_TRIPLES,
  COMBINED_MAX_CAPACITY,
  TRIPLE_MIN_GUESTS,
  TRIPLE_MAX_CAPACITY,
} from "@/lib/tableAdjacency";
import { getShiftWindow } from "@/lib/shifts";
import type { ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
  try {
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
    if (isNaN(guests) || guests < 1 || guests > TRIPLE_MAX_CAPACITY) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `Número de personas inválido (1–${TRIPLE_MAX_CAPACITY})` },
        { status: 400 }
      );
    }

    const reservationStart = new Date(`${date}T${time}:00`);
    if (isNaN(reservationStart.getTime())) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Fecha u hora inválida" },
        { status: 400 }
      );
    }

    const { start: shiftStart, end: shiftEnd } = getShiftWindow(reservationStart);

    const dbSection = await prisma.section.findUnique({
      where: { name: section },
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

    // Reservas activas en el mismo turno → mesas ocupadas
    const conflicts = await prisma.reservation.findMany({
      where: {
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        date:   { gte: shiftStart, lt: shiftEnd },
        OR: [
          { tableId:       { in: tableIds } },
          { linkedTableId: { in: tableIds } },
          { thirdTableId:  { in: tableIds } },
        ],
      },
      select: { tableId: true, linkedTableId: true, thirdTableId: true },
    });

    const occupiedIds = new Set<string>();
    for (const c of conflicts) {
      if (c.tableId)       occupiedIds.add(c.tableId);
      if (c.linkedTableId) occupiedIds.add(c.linkedTableId);
      if (c.thirdTableId)  occupiedIds.add(c.thirdTableId);
    }

    const tables = dbSection.tables.map((t) => ({
      id:       t.id,
      number:   t.number,
      capacity: t.capacity,
      status:   (occupiedIds.has(t.id) ? "occupied" : "available") as "available" | "occupied",
    }));

    const byNumber = new Map(tables.map((t) => [t.number, t]));

    // ── Pares disponibles (5-6 personas) ─────────────────
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

    // ── Triples disponibles (7-8 personas) ───────────────
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

    const hasAvailability =
      tables.some((t) => t.status === "available" && t.capacity >= guests) ||
      pairs.length > 0 ||
      triples.length > 0;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { sectionName: dbSection.name, tables, pairs, triples, hasAvailability },
    });
  } catch (error) {
    console.error("[API] GET /api/reservations/available-tables error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Error al buscar disponibilidad" },
      { status: 500 }
    );
  }
}
