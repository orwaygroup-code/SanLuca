/**
 * Cálculo de totales de Comanda — SIEMPRE en backend (nunca confiar en el
 * frontend). El IVA es configurable vía RestaurantSettings (Fase B.1):
 *
 *   - taxEnabled=true:  los precios YA incluyen IVA. Se desglosa hacia atrás.
 *       subtotal = total / (1 + taxRate);  taxAmount = total - subtotal
 *   - taxEnabled=false: sin IVA. subtotal = total; taxAmount = 0
 */

export interface TaxSettings {
  taxEnabled: boolean;
  taxRate:    number; // ej. 0.16
}

export interface ComandaTotals {
  subtotal:  number;
  taxAmount: number;
  total:     number;
}

/** Redondeo a 2 decimales (centavos). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** lineTotal de un item: (precio unitario + extra de modificadores) × cantidad. */
export function lineTotal(unitPrice: number, quantity: number, modifiersExtraCost = 0): number {
  return round2((unitPrice + modifiersExtraCost) * quantity);
}

/**
 * Monto BRUTO (IVA incluido) de un descuento sobre una base dada.
 * - PERCENT: base × value/100 (value = 10 → 10%).
 * - FIXED:   value en pesos.
 * Siempre acotado a [0, base] → nunca deja el total negativo. El IVA se desglosa
 * después en computeTotals sobre el bruto ya descontado (los precios incluyen IVA).
 */
export function computeDiscountAmount(
  base: number,
  type: "PERCENT" | "FIXED",
  value: number,
): number {
  if (!(base > 0) || !(value > 0)) return 0;
  const raw = type === "PERCENT" ? base * (value / 100) : value;
  return round2(Math.min(Math.max(0, raw), base));
}

/** Totales de la comanda a partir de los lineTotals (IVA incluido si aplica). */
export function computeTotals(lineTotals: number[], settings: TaxSettings): ComandaTotals {
  const total = round2(lineTotals.reduce((sum, x) => sum + x, 0));
  if (!settings.taxEnabled) {
    return { subtotal: total, taxAmount: 0, total };
  }
  const subtotal  = round2(total / (1 + settings.taxRate));
  const taxAmount = round2(total - subtotal);
  return { subtotal, taxAmount, total };
}
