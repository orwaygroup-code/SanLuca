import type { StaffRole } from "./staff-session";

/** Estados en los que la cuenta admite cambios (agregar, cancelar, descontar). */
export const EDITABLE_STATUSES = ["OPEN", "IN_SERVICE"] as const;

export function isEditableStatus(status: string): boolean {
  return (EDITABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Estado en que queda una cuenta PAID al reabrirse.
 *
 * Con los pagos anulados la cuenta vuelve a estar sin cobrar, así que regresa a
 * IN_SERVICE y el mesero recupera todas las acciones de mesa en servicio.
 * Conservando los pagos, el dinero sigue encima: editar productos podría dejar
 * el total por debajo de lo cobrado, así que permanece bloqueada y para
 * editarla está /unlock, con su propia autorización.
 *
 * Vive aquí, junto a las reglas puras, para poder fijar por prueba la
 * invariante que se rompió: reabrir con pagos anulados TIENE que devolver un
 * estado editable. Antes devolvía siempre AWAITING_PAYMENT, así que reabrir
 * dejaba la cuenta tan bloqueada como estaba.
 */
export function statusAfterReopen(voidPayments: boolean): "IN_SERVICE" | "AWAITING_PAYMENT" {
  return voidPayments ? "IN_SERVICE" : "AWAITING_PAYMENT";
}

/**
 * Reglas de permisos y helpers PUROS del sistema de Comandas (Fase B.1).
 * Sin DB — testeables directamente. Los endpoints las consumen.
 */

export const isCaptainOrManager = (role: StaffRole): boolean =>
  role === "CAPTAIN" || role === "MANAGER";

/**
 * ¿Puede este staff capturar/modificar la comanda?
 * - WAITER: solo SUS comandas (waiterId === su staffId).
 * - CAPTAIN / MANAGER: cualquiera.
 * - OPERATION: solo SUS comandas (las cuentas "para llevar" / sin mesa que ella
 *   misma abre en Caja llevan su waiterId, y debe poder capturarles platillos).
 */
export function canModifyComanda(role: StaffRole, isOwner: boolean): boolean {
  if (isCaptainOrManager(role)) return true;
  if (role === "WAITER" || role === "OPERATION") return isOwner;
  return false;
}

/**
 * ¿Puede cancelar un item?
 * - status PENDING (no enviado): WAITER dueño o CAPTAIN/MANAGER.
 * - status SENT o posterior: SOLO CAPTAIN/MANAGER.
 */
export function canCancelItem(args: { role: StaffRole; isOwner: boolean; itemStatus: string }): boolean {
  const notSentYet = args.itemStatus === "PENDING";
  if (notSentYet) return canModifyComanda(args.role, args.isOwner);
  return isCaptainOrManager(args.role);
}

/**
 * Decisión de impresión de ticket de cliente (regla "1 print").
 * - Si NO existe aún un CUSTOMER_FINAL para la comanda → primera impresión:
 *   WAITER (de su comanda) u OPERATION/CAPTAIN/MANAGER. Tipo CUSTOMER_FINAL.
 * - Si YA existe → reimpresión: SOLO CAPTAIN/MANAGER con authorizationReason.
 *   Tipo CUSTOMER_REPRINT.
 */
export function decidePrint(args: {
  role: StaffRole;
  isOwner: boolean;
  alreadyPrinted: boolean;
  authorizationReason?: string | null;
}): { allowed: boolean; type?: "CUSTOMER_FINAL" | "CUSTOMER_REPRINT"; error?: string } {
  if (!args.alreadyPrinted) {
    const ok = args.role === "WAITER" ? args.isOwner : true; // OPERATION/CAPTAIN/MANAGER ok
    return ok
      ? { allowed: true, type: "CUSTOMER_FINAL" }
      : { allowed: false, error: "Solo puedes imprimir tickets de tus comandas" };
  }
  if (!isCaptainOrManager(args.role)) {
    return { allowed: false, error: "La reimpresión la autoriza un Capitán o Manager" };
  }
  if (!args.authorizationReason || !args.authorizationReason.trim()) {
    return { allowed: false, error: "authorizationReason es obligatorio para reimprimir" };
  }
  return { allowed: true, type: "CUSTOMER_REPRINT" };
}

/** Folio COM-AAAA-NNNN (NNNN secuencial por año, 4 dígitos). */
export function formatFolio(year: number, seq: number): string {
  return `COM-${year}-${String(seq).padStart(4, "0")}`;
}

/** Folio de sesión de caja CAJA-AAAA-NNNN. */
export function formatCashFolio(year: number, seq: number): string {
  return `CAJA-${year}-${String(seq).padStart(4, "0")}`;
}

/** prepArea → impresora física (PrintTarget) al enviar a cocina/barra. */
export function prepAreaToTarget(prepArea: "BARRA" | "COCINA"): "BARRA" | "COCINA" {
  return prepArea; // 1:1 en B.1 (2 áreas). Si se subdividen áreas, se mapea aquí.
}

export interface SplitUnit { itemId: number; quantity: number }
export interface SplitInput { units: SplitUnit[] }
export interface SplitTicket { ticketNumber: number; units: SplitUnit[]; total: number }

/**
 * Construye la config de cada ticket de una división de cuenta (Fase B.2).
 * `splits` define los grupos de UNIDADES (itemId + quantity) — permite dividir
 * fracciones de un mismo platillo entre comensales (p.ej. "Pasta ×2", uno cada quien).
 * `itemsById` da el precio unitario / cantidad / lineTotal de cada item vivo.
 *
 * El total de cada ticket = Σ (unitPriceSnapshot × quantity) por unidad. Se usa
 * el precio unitario directo (no lineTotal/cantidad) para evitar drift de redondeo.
 * Devuelve un SplitTicket por grupo (→ el endpoint crea un ComandaPrint por cada uno).
 */
export function buildSplits(
  splits: SplitInput[],
  itemsById: Map<number, { unitPriceSnapshot: number; quantity: number; lineTotal: number }>,
): SplitTicket[] {
  return splits.map((s, i) => ({
    ticketNumber: i + 1,
    units: s.units,
    total: Math.round(
      s.units.reduce((sum, u) => sum + (itemsById.get(u.itemId)?.unitPriceSnapshot ?? 0) * u.quantity, 0) * 100,
    ) / 100,
  }));
}
