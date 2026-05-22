import type { Prisma, PrismaClient, ReservationStatus } from "@prisma/client";

/**
 * Detección de conflictos de mesa centralizada.
 *
 * Reemplaza el modelo viejo "una mesa, un turno" (brunch 8-14 / cena 14-cierre)
 * por una ventana deslizante de ±4 horas. También excluye reservaciones en
 * estado COMPLETED — si la cena ya cerró, la mesa está libre para la siguiente.
 *
 * Regla exacta — **bloquea** si existe una reservación EN OTRA mesa de la lista
 * que cumpla TODAS estas condiciones:
 *   1. `status` NOT IN (`CANCELLED`, `NO_SHOW`, `COMPLETED`)
 *   2. `|nueva.date - existente.date| < 4h`  (estricto)
 *
 * Por implementación con Prisma: `gt: date - 4h` y `lt: date + 4h` (exclusivos).
 * Si la diferencia es **exactamente 4h** → no matchea → permite. Ejemplo natural:
 * brunch 14:30 + cena 18:30 (turnover esperado).
 */

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/** Estados que NO bloquean una nueva reservación cercana. */
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
 * (raro — el primer hit basta para devolver 409), usa `findManyConflicts`.
 */
export async function findTableConflict(
  db: DB,
  input: TableConflictInput,
): Promise<ConflictRow | null> {
  if (input.tableIds.length === 0) return null;

  const { reservationDate, tableIds, excludeReservationId } = input;
  const windowStart = new Date(reservationDate.getTime() - FOUR_HOURS_MS);
  const windowEnd   = new Date(reservationDate.getTime() + FOUR_HOURS_MS);

  const where: Prisma.ReservationWhereInput = {
    status: { notIn: NON_BLOCKING_STATUSES },
    // gt / lt exclusivos: diff exacto de 4h queda FUERA → permite (turnover natural).
    date:   { gt: windowStart, lt: windowEnd },
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
 * mesas ocupadas en la ventana ±4h del slot que estamos asignando, no solo la
 * primera conflictiva.
 */
export async function findOccupiedTableIds(
  db: DB,
  reservationDate: Date,
): Promise<Set<string>> {
  const windowStart = new Date(reservationDate.getTime() - FOUR_HOURS_MS);
  const windowEnd   = new Date(reservationDate.getTime() + FOUR_HOURS_MS);

  const rows = await db.reservation.findMany({
    where: {
      status: { notIn: NON_BLOCKING_STATUSES },
      date:   { gt: windowStart, lt: windowEnd },
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

// Exportado para tests / debug — la constante de ventana.
export const CONFLICT_WINDOW_MS = FOUR_HOURS_MS;
