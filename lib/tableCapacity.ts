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
