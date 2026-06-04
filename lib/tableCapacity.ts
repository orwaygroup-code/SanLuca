/**
 * Regla central para decidir si una mesa puede recibir una cantidad de comensales.
 *
 * Excepción: las mesas con cupo nominal de 6 también admiten reservas de 8 personas
 * (sin necesidad de combinar dos mesas). El resto se comporta como un >=
 * estricto contra la capacidad.
 */
export function tableFitsGuests(capacity: number, guests: number): boolean {
  if (capacity >= guests) return true;
  if (capacity === 6 && guests === 8) return true;
  return false;
}

/** Capacidad combinada de un conjunto de mesas (suma de cupos nominales). */
export function combinedCapacity(capacities: number[]): number {
  return capacities.reduce((sum, c) => sum + c, 0);
}

export interface CapacityDecision {
  ok:               boolean; // ¿se permite la asignación?
  requiresOverride: boolean; // ¿la capacidad es insuficiente (override manual)?
  capacity:         number;
  guests:           number;
}

/**
 * Decide si asignar mesa(s) de `capacity` total a `guests` comensales.
 * Usado por "Cambiar Mesa" para el override de capacidad con auditoría:
 *   - capacidad suficiente            → ok, sin override.
 *   - insuficiente + forceAssign=false → bloquea (ok=false, requiresOverride=true).
 *   - insuficiente + forceAssign=true  → permite con override (ok=true, requiresOverride=true).
 */
export function evaluateCapacity(
  capacity: number,
  guests: number,
  forceAssign: boolean,
): CapacityDecision {
  if (tableFitsGuests(capacity, guests)) {
    return { ok: true, requiresOverride: false, capacity, guests };
  }
  return { ok: forceAssign, requiresOverride: true, capacity, guests };
}
