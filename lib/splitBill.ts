import type { ComandaMoney } from "./displayTotals";
import type { SplitUnit, SplitInput } from "./comandaRules";

/**
 * Helpers PUROS de la división de cuenta por UNIDADES (Fase B.2). Compartidos
 * entre la UI del mesero y el endpoint de impresión (defensa en profundidad).
 * Una división asigna `quantity` unidades de uno o más `itemId`; permite repartir
 * fracciones de un mismo platillo (p.ej. "Pasta ×2" → uno cada comensal).
 * Sin DB — testeable directamente.
 */

/**
 * Construye el `splits` que espera POST /api/comandas/:id/print a partir de las
 * divisiones del mesero (cada una un Map itemId→quantity) + las unidades que
 * quedaron en la matriz (sin asignar).
 *
 * La matriz, si tiene unidades, se anexa como división final automática — Paul:
 * "imprimir el ticket junto con sus respectivas divisiones".
 *
 * - 0 divisiones → undefined (impresión normal de un solo ticket).
 * - 1+ divisiones, matriz vacía → solo las divisiones.
 * - 1+ divisiones, matriz con unidades → divisiones + { units: matriz } al final.
 */
export function buildSplitsPayload(
  splits: Map<number, number>[],
  matrixUnits: SplitUnit[],
): SplitInput[] | undefined {
  if (splits.length === 0) return undefined;
  const groups: SplitInput[] = splits
    .map((m) => ({
      units: [...m.entries()]
        .filter(([, q]) => q > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity })),
    }))
    .filter((g) => g.units.length > 0);
  const matrix = matrixUnits.filter((u) => u.quantity > 0).map((u) => ({ itemId: u.itemId, quantity: u.quantity }));
  if (matrix.length > 0) groups.push({ units: matrix });
  return groups.length > 0 ? groups : undefined;
}

/**
 * Valida los `splits` del request contra los items vivos de la comanda. Pura,
 * la usa el endpoint como defensa en profundidad (la UI ya impide pasarse del
 * cupo). `maxQtyById` mapea itemId → cantidad ordenada (solo items NO cancelados).
 */
export function validateSplits(
  splits: SplitInput[],
  maxQtyById: Map<number, number>,
): { ok: true } | { ok: false; error: string } {
  const assigned = new Map<number, number>();
  for (const g of splits) {
    if (!g || !Array.isArray(g.units) || g.units.length === 0) {
      return { ok: false, error: "Cada división debe incluir al menos un platillo" };
    }
    for (const u of g.units) {
      const itemId = Number(u?.itemId);
      const quantity = Number(u?.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return { ok: false, error: "Cantidad inválida en la división (debe ser entero ≥ 1)" };
      }
      if (!maxQtyById.has(itemId)) {
        return { ok: false, error: "La división contiene platillos que no existen en la comanda" };
      }
      assigned.set(itemId, (assigned.get(itemId) ?? 0) + quantity);
    }
  }
  for (const [itemId, sum] of assigned) {
    if (sum > (maxQtyById.get(itemId) ?? 0)) {
      return { ok: false, error: "No puedes dividir más unidades de las que se ordenaron" };
    }
  }
  return { ok: true };
}

/**
 * Subtotal de un grupo de unidades = Σ (unitPriceSnapshot × quantity). Se usa el
 * precio unitario directo (no fracción de lineTotal) para evitar drift de redondeo.
 */
export function unitsSubtotal(units: SplitUnit[], unitPriceById: Map<number, number>): number {
  return units.reduce((s, u) => s + (unitPriceById.get(u.itemId) ?? 0) * u.quantity, 0);
}

/**
 * Tasa de IVA efectiva derivada de los totales de la comanda (la página solo
 * conoce el flag taxEnabled, no el % configurado). 0 si no hay subtotal.
 */
export function effectiveTaxRate(money: ComandaMoney): number {
  const subtotal = Number(money.subtotal);
  if (!subtotal) return 0;
  return Number(money.taxAmount) / subtotal;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Desglose monetario de UNA división para el preview, dado su subtotal (Σ
 * unitPriceSnapshot × quantity) y la tasa de IVA. Con IVA: subtotal + IVA +
 * total; sin IVA el total es el subtotal. El total general autoritativo sigue
 * siendo el de la comanda — esto es solo presentación por sección.
 */
export function divisionMoney(subtotal: number, rate: number, taxEnabled: boolean): ComandaMoney {
  const taxAmount = taxEnabled ? round2(subtotal * rate) : 0;
  return { subtotal: round2(subtotal), taxAmount, total: round2(subtotal + taxAmount) };
}
