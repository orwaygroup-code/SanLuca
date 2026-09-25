/**
 * Nómina (Ola N-1). Lógica PURA, sin base de datos.
 *
 * El sueldo es una HISTORIA con fecha: el vigente se DERIVA (no es una columna que se
 * sobrescribe). Aquí vive esa derivación y el cálculo del neto contra créditos.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Sueldo VIGENTE a una fecha (`at`, por omisión ahora): de los registros con
 * `effectiveFrom <= at`, el de fecha más reciente; si dos empatan en fecha, el de `id`
 * mayor (si el objeto lo trae). No asume que la lista venga ordenada. Ninguno aplicable → null.
 */
export function currentSalary<T extends { effectiveFrom: Date }>(rows: T[], at: Date = new Date()): T | null {
  const cutoff = at.getTime();
  let best: T | null = null;
  for (const r of rows) {
    if (r.effectiveFrom.getTime() > cutoff) continue; // fecha futura: aún no aplica
    if (best === null) { best = r; continue; }
    const diff = r.effectiveFrom.getTime() - best.effectiveFrom.getTime();
    if (diff > 0) {
      best = r;
    } else if (diff === 0) {
      const rid = (r as { id?: number }).id;
      const bid = (best as { id?: number }).id;
      if (typeof rid === "number" && typeof bid === "number" && rid > bid) best = r;
    }
  }
  return best;
}

/**
 * Neto a pagar y saldo que queda debiendo, ambos a 2 decimales.
 * - `net`  = max(0, salary − credit): lo que se le paga. Nunca negativo (no se puede
 *   descontar más de lo que se le paga).
 * - `carry` = max(0, credit − salary): el crédito que sobra y sigue pendiente.
 */
export function netPay(salary: number, credit: number): { net: number; carry: number } {
  return { net: round2(Math.max(0, salary - credit)), carry: round2(Math.max(0, credit - salary)) };
}
