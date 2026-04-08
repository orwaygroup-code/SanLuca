// lib/tableAdjacency.ts
// Mesas físicamente contiguas que pueden combinarse.
// Pares → grupos de 5-6 personas.
// Triples → grupos de 7-8 personas.
// Los números son globalmente únicos en el restaurante (M1–M25).

export const ADJACENT_PAIRS: readonly [number, number][] = [
  // ── Salón ──────────────────
  [1, 2],   // sillón M1(3) + M2(2) = 5
  [5, 6],   // M5(4)  + M6(4) = cap 6
  [3, 8],   // M3(4)  + M8(4) = cap 6
  // ── Terraza ────────────────
  [10, 11], // 4+4 = cap 6
  [12, 13], // 2+4 = 6
  [14, 15], // 2+4 = 6
  [16, 17], // 4+4 = cap 6
  [17, 18], // 4+4 = cap 6  (M17 comparte con ambos lados)
  // ── Planta Alta ────────────
  [20, 21], // 4+4 = cap 6
  [22, 23], // 4+4 = cap 6
  [24, 25], // 4+4 = cap 6
] as const;

// Triples: 3 mesas adyacentes para 7-8 personas
export const ADJACENT_TRIPLES: readonly [number, number, number][] = [
  // ── Salón ──────────────────
  [8, 7, 4],    // grid izquierdo (4+2+2 = 8 caps)
  [5, 6, 1],    // sillones (4+4+3 = 11 caps)
  // ── Terraza ────────────────
  [16, 15, 14], // fila inferior izquierda
  [14, 13, 12], // fila inferior centro
  // ── Planta Alta ────────────
  [20, 21, 22], // columna central
  [23, 24, 25], // cluster izquierdo
] as const;

export const COMBINED_MAX_CAPACITY = 6;   // máx para par
export const TRIPLE_MIN_GUESTS     = 7;   // mín para triple
export const TRIPLE_MAX_CAPACITY   = 12;  // máx para triple

/** Devuelve todos los pares que involucran a este número de mesa. */
export function getPairsForTable(tableNumber: number): [number, number][] {
  return (ADJACENT_PAIRS as unknown as [number, number][]).filter(
    ([a, b]) => a === tableNumber || b === tableNumber
  );
}

/** Dado un número de mesa, devuelve su pareja adyacente (la primera). */
export function getAdjacentPartner(tableNumber: number): number | null {
  for (const [a, b] of ADJACENT_PAIRS) {
    if (a === tableNumber) return b;
    if (b === tableNumber) return a;
  }
  return null;
}

/** Devuelve todos los triples que involucran a este número de mesa. */
export function getTriplesForTable(tableNumber: number): [number, number, number][] {
  return (ADJACENT_TRIPLES as unknown as [number, number, number][]).filter(
    ([a, b, c]) => a === tableNumber || b === tableNumber || c === tableNumber
  );
}
