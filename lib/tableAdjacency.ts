// lib/tableAdjacency.ts
// Pares de mesas físicamente pegadas que pueden combinarse para grupos de 5–6 personas.
// Formato: [número_mesa_A, número_mesa_B]
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

export const COMBINED_MAX_CAPACITY = 6;

/** Devuelve todos los pares de adyacencia que involucran a este número de mesa. */
export function getPairsForTable(tableNumber: number): [number, number][] {
  return (ADJACENT_PAIRS as unknown as [number, number][]).filter(
    ([a, b]) => a === tableNumber || b === tableNumber
  );
}

/** Dado un número de mesa, devuelve su pareja adyacente (solo la primera si hay varias). */
export function getAdjacentPartner(tableNumber: number): number | null {
  for (const [a, b] of ADJACENT_PAIRS) {
    if (a === tableNumber) return b;
    if (b === tableNumber) return a;
  }
  return null;
}
