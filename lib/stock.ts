/**
 * Almacén (Ola A-1). Lógica PURA, sin base de datos.
 *
 * Principio: los MOVIMIENTOS son la verdad. `StockItem.stock` es un derivado que se
 * recalcula con `nextBalance` DENTRO de la transacción que crea el movimiento (candado
 * optimista en el endpoint). Aquí solo vive la aritmética y las reglas, sin efectos.
 */

export type StockMoveType = "ENTRADA" | "SALIDA" | "MERMA" | "AJUSTE";

export const STOCK_MOVE_TYPES: readonly StockMoveType[] = ["ENTRADA", "SALIDA", "MERMA", "AJUSTE"] as const;

/**
 * Motivos ESTRUCTURADOS por tipo (Ola A-4). Textos EXACTOS (acentos incluidos): se
 * guardan tal cual en `StockMovement.reasonCode` y son lo que el manager agrupa después.
 * "Otro" exige explicar en el comentario libre (`reason`).
 */
export const STOCK_REASONS: Record<StockMoveType, readonly string[]> = {
  ENTRADA: ["Compra a proveedor", "Devolución", "Traspaso de otra área", "Otro"],
  SALIDA: ["Preparación del servicio", "Traspaso a barra", "Consumo de personal", "Evento", "Otro"],
  MERMA: ["Caducado", "Se echó a perder", "Se rompió o derramó", "Error de preparación", "Otro"],
  AJUSTE: ["Conteo físico", "Corrección de captura", "Otro"],
};

/** Cantidad máxima admitida (cabe en Decimal(12,3)). */
const MAX_QTY = 999999.999;

/**
 * Redondea a 3 decimales, como `Decimal(12,3)`. Robusto ante el error de coma flotante:
 * pasa por string exponencial para que 2.5005 → 2.501 y 0.1+0.2 → 0.3 (y no 2.5 / 0.30000004).
 */
export function round3(n: number): number {
  return Number(`${Math.round(Number(`${n}e3`))}e-3`);
}

/**
 * Saldo tras aplicar un movimiento. AJUSTE = conteo físico: REEMPLAZA el saldo (no suma
 * ni resta). Los demás suman (ENTRADA) o restan (SALIDA, MERMA). Siempre redondeado.
 */
export function nextBalance(current: number, type: StockMoveType, quantity: number): number {
  if (type === "ENTRADA") return round3(current + quantity);
  if (type === "AJUSTE") return round3(quantity);
  return round3(current - quantity); // SALIDA, MERMA
}

/**
 * Valida un movimiento contra el stock actual. Orden de reglas:
 *  a. quantity no finito → "Cantidad inválida".
 *  b. AJUSTE con quantity < 0 → "Cantidad inválida"; los otros con quantity <= 0 → "…mayor que cero".
 *  c. quantity > 999999.999 → "Cantidad demasiado grande".
 *  d. `reasonCode` vacío → "Elige un motivo" (obligatorio en los cuatro tipos, Ola A-4).
 *  e. `reasonCode` que no esté en STOCK_REASONS[type] → "Motivo no válido".
 *  f. `reasonCode === "Otro"` y `reason` (comentario) vacío → "Explica el motivo en el comentario".
 *  g. SALIDA/MERMA que dejarían el saldo < 0 → "No hay suficiente: hay <stock>".
 *     (Un stock negativo es un dato falso que nadie corrige; si de verdad hay más, la
 *     salida correcta es un AJUSTE.)
 * `reason` ya NO es el motivo: es el comentario libre opcional (salvo en "Otro").
 */
export function validateMovement(input: {
  type: StockMoveType;
  quantity: number;
  reasonCode?: string | null;
  reason?: string | null;
  currentStock: number;
}): { ok: true } | { ok: false; error: string } {
  const { type, quantity, currentStock } = input;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  const reasonCode = typeof input.reasonCode === "string" ? input.reasonCode.trim() : "";

  if (!Number.isFinite(quantity)) return { ok: false, error: "Cantidad inválida" };

  if (type === "AJUSTE") {
    if (quantity < 0) return { ok: false, error: "Cantidad inválida" };
  } else if (quantity <= 0) {
    return { ok: false, error: "La cantidad debe ser mayor que cero" };
  }

  if (quantity > MAX_QTY) return { ok: false, error: "Cantidad demasiado grande" };

  if (reasonCode.length === 0) return { ok: false, error: "Elige un motivo" };
  if (!STOCK_REASONS[type].includes(reasonCode)) return { ok: false, error: "Motivo no válido" };
  if (reasonCode === "Otro" && reason.length === 0) return { ok: false, error: "Explica el motivo en el comentario" };

  if ((type === "SALIDA" || type === "MERMA") && round3(currentStock - quantity) < 0) {
    return { ok: false, error: `No hay suficiente: hay ${round3(currentStock)}` };
  }

  return { ok: true };
}
