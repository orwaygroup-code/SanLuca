import type { Prisma, PrismaClient, ReservationStatus } from "@prisma/client";
import { getShiftWindow } from "./shifts";

/**
 * Detección de conflictos de mesa centralizada.
 *
 * Modelo: **una mesa = una reserva por TURNO** (brunch 08:00-14:00 / cena
 * 14:00-cierre). La ocupación se calcula con la ventana del turno
 * (`getShiftWindow`), quedando consistente con el mapa de disponibilidad
 * (`available-tables`) y con la asignación manual del staff.
 *
 * > Histórico: antes se usaba una ventana deslizante de ±4h (permitía
 * > turnover brunch 14:30 + cena 18:30 en la misma mesa). Se revirtió al
 * > modelo por turno por decisión operativa (Fase A — fix editor), para
 * > eliminar la divergencia mapa-vs-autoasignación.
 *
 * Regla — **bloquea** si existe una reservación EN una de las mesas de la
 * lista que cumpla TODAS estas condiciones:
 *   1. `status` NOT IN (`CANCELLED`, `NO_SHOW`, `COMPLETED`)
 *   2. su `date` cae dentro del MISMO turno que la reservación nueva
 *      (`date >= turno.start && date < turno.end`).
 */

/** Estados que NO bloquean una nueva reservación en el mismo turno. */
const NON_BLOCKING_STATUSES: ReservationStatus[] = ["CANCELLED", "NO_SHOW", "COMPLETED"];

type DB = PrismaClient | Prisma.TransactionClient;

export interface TableConflictInput {
  /** Mesas a chequear. Cualquier match en `tableId / linkedTableId / thirdTableId / fourthTableId`. */
  tableIds:        string[];
  /** Fecha+hora de la reservación que se quiere crear. */
  reservationDate: Date;
  /** Excluir esta reservación del check (útil al editar, no choca consigo misma). */
  excludeReservationId?: string;
}

export interface ConflictRow {
  id:        string;
  date:      Date;
  status:    ReservationStatus;
  guestName: string;
}

/**
 * Devuelve la primera reservación conflictiva o null. Si necesitas todas
 * las mesas ocupadas del turno (auto-asignación), usa `findOccupiedTableIds`.
 */
export async function findTableConflict(
  db: DB,
  input: TableConflictInput,
): Promise<ConflictRow | null> {
  if (input.tableIds.length === 0) return null;

  const { reservationDate, tableIds, excludeReservationId } = input;
  const { start, end } = getShiftWindow(reservationDate);

  const where: Prisma.ReservationWhereInput = {
    status: { notIn: NON_BLOCKING_STATUSES },
    // Mismo turno: [start, end) — coincide con available-tables y los checks
    // de /api/admin/reservations/[id].
    date:   { gte: start, lt: end },
    OR: tableIds.flatMap((id) => [
      { tableId:       id },
      { linkedTableId: id },
      { thirdTableId:  id },
      { fourthTableId: id },
    ]),
  };
  if (excludeReservationId) {
    where.NOT = { id: excludeReservationId };
  }

  return db.reservation.findFirst({
    where,
    select: { id: true, date: true, status: true, guestName: true },
    orderBy: { date: "asc" },
  });
}

/**
 * Versión bulk: para el algoritmo de auto-asignación, queremos saber TODAS
 * las mesas ocupadas en el MISMO turno del slot que estamos asignando.
 */
export async function findOccupiedTableIds(
  db: DB,
  reservationDate: Date,
): Promise<Set<string>> {
  const { start, end } = getShiftWindow(reservationDate);

  const rows = await db.reservation.findMany({
    where: {
      status: { notIn: NON_BLOCKING_STATUSES },
      date:   { gte: start, lt: end },
    },
    select: { tableId: true, linkedTableId: true, thirdTableId: true, fourthTableId: true },
  });

  const occupied = new Set<string>();
  for (const r of rows) {
    if (r.tableId)       occupied.add(r.tableId);
    if (r.linkedTableId) occupied.add(r.linkedTableId);
    if (r.thirdTableId)  occupied.add(r.thirdTableId);
    if (r.fourthTableId) occupied.add(r.fourthTableId);
  }
  return occupied;
}
