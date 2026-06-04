import type { StaffRole } from "./staff-session";

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
 * - OPERATION: no captura items.
 */
export function canModifyComanda(role: StaffRole, isOwner: boolean): boolean {
  if (isCaptainOrManager(role)) return true;
  if (role === "WAITER") return isOwner;
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

/** prepArea → impresora física (PrintTarget) al enviar a cocina/barra. */
export function prepAreaToTarget(prepArea: "BARRA" | "COCINA"): "BARRA" | "COCINA" {
  return prepArea; // 1:1 en B.1 (2 áreas). Si se subdividen áreas, se mapea aquí.
}

export interface SplitTicket { ticketNumber: number; itemIds: number[]; total: number }

/**
 * Construye la config de cada ticket de una división de cuenta.
 * `splits` define los grupos de itemIds; `itemTotalById` da el lineTotal de cada item.
 * Devuelve un SplitTicket por grupo (→ el endpoint crea un ComandaPrint por cada uno).
 */
export function buildSplits(
  splits: { itemIds: number[] }[],
  itemTotalById: Map<number, number>,
): SplitTicket[] {
  return splits.map((s, i) => ({
    ticketNumber: i + 1,
    itemIds: s.itemIds,
    total: Math.round(
      s.itemIds.reduce((sum, id) => sum + (itemTotalById.get(id) ?? 0), 0) * 100,
    ) / 100,
  }));
}
