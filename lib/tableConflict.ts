import type { Prisma, PrismaClient, ReservationStatus } from "@prisma/client";

/**
 * Detección de conflictos de mesa centralizada.
 *
 * Modelo: ventana deslizante de **±3.5h** alrededor del horario de la reserva
 * (permite rotación de mesas dentro de la noche — ~2 turnos sobre la misma
 * mesa). Se aplica de forma CONSISTENTE en TODOS los paths que validan
 * ocupación (create web/admin/bot, edición, cambio de mesa, mapa de
 * disponibilidad). La divergencia entre paths era el bug original, no la
 * duración. `getShiftWindow` (lib/shifts.ts) queda solo para reportes por
 * turno, NO para validar ocupación.
 *
 * Regla — **bloquea** si existe una reserva EN una de las mesas de la lista que
 * cumpla TODAS estas condiciones:
 *   1. `status` NOT IN (`CANCELLED`, `NO_SHOW`, `COMPLETED`)
 *   2. `|existente.date - nueva.date| < 3.5h`
 *
 * Implementación con `gt`/`lt` EXCLUSIVOS: una separación de exactamente 3.5h
 * queda FUERA de la ventana → se PERMITE (límite inclusivo en favor de aceptar).
 */

// TODO multi-tenant: esto debe migrar a TenantReservationConfig.reservationDurationHours
// cuando llegue Fase 1 del plan multi-tenant. Cada restaurante tendrá su propia duración.
export const RESERVATION_WINDOW_HOURS = 3.5;

const WINDOW_MS = RESERVATION_WINDOW_HOURS * 60 * 60 * 1000;

/** Ventana de ocupación [from, to] = `date` ± 3.5h. */
export function getReservationWindow(date: Date): { from: Date; to: Date } {
  return {
    from: new Date(date.getTime() - WINDOW_MS),
    to:   new Date(date.getTime() + WINDOW_MS),
  };
}

/** Estados que NO bloquean una nueva reservación cercana. */
export const NON_BLOCKING_STATUSES: ReservationStatus[] = ["CANCELLED", "NO_SHOW", "COMPLETED"];

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
 * Devuelve la primera reservación conflictiva o null. Si necesitas todas las
 * mesas ocupadas en la ventana (auto-asignación), usa `findOccupiedTableIds`.
 */
export async function findTableConflict(
  db: DB,
  input: TableConflictInput,
): Promise<ConflictRow | null> {
  if (input.tableIds.length === 0) return null;

  const { reservationDate, tableIds, excludeReservationId } = input;
  const { from, to } = getReservationWindow(reservationDate);

  const where: Prisma.ReservationWhereInput = {
    status: { notIn: NON_BLOCKING_STATUSES },
    // gt / lt EXCLUSIVOS: separación de exactamente 3.5h queda fuera → permite.
    date:   { gt: from, lt: to },
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
 * Versión bulk: para el algoritmo de auto-asignación, queremos saber TODAS las
 * mesas ocupadas en la ventana ±3.5h del slot que estamos asignando.
 */
export async function findOccupiedTableIds(
  db: DB,
  reservationDate: Date,
): Promise<Set<string>> {
  const { from, to } = getReservationWindow(reservationDate);

  const rows = await db.reservation.findMany({
    where: {
      status: { notIn: NON_BLOCKING_STATUSES },
      date:   { gt: from, lt: to },
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
