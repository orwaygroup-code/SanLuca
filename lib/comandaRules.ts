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


/** Roles que pueden AUTORIZAR una reimpresión tecleando su PIN. */
export const REPRINT_AUTHORIZER_ROLES = ["CAPTAIN", "MANAGER"] as const;

/** ¿Este rol reimprime sin que nadie más lo autorice? */
export function isReprintAuthorizer(role: string | null | undefined): boolean {
  // ADMIN entra por el realm sl_session (Ricardo desde /admin); CAPTAIN y
  // MANAGER por sl_staff con PIN.
  return role === "CAPTAIN" || role === "MANAGER" || role === "ADMIN";
}

export type ReprintAuth =
  | { ok: true; authorizedById: number }
  | { ok: false; error: string; status: 403 };

/**
 * Quién queda registrado como autorizador de una reimpresión.
 *
 * Dos vías, y sólo dos: el supervisor que tiene la sesión abierta, o cualquier
 * miembro de la caja acompañado del PIN de un Capitán o Manager. La segunda
 * existe porque quien está frente a la impresora es el cajero, y obligarlo a
 * cerrar sesión para que un supervisor autorice un papel es la clase de
 * fricción que acaba en que nadie reimprima.
 *
 * Vive aquí, y no dentro de cada endpoint, porque la usan la reimpresión del
 * ticket y la de cocina. Una regla de jerarquía repetida en dos sitios es una
 * regla que tarde o temprano deja de coincidir consigo misma.
 */
export function resolveReprintAuthorizer(args: {
  operatorRole: string | null | undefined;
  operatorStaffId: number;
  /** Si se mandó PIN: el staffId que devolvió la verificación, o null si no era válido. */
  pinAuthorizedId?: number | null;
  /** Si el cliente mandó un PIN, aunque fuera incorrecto. */
  pinProvided?: boolean;
}): ReprintAuth {
  if (isReprintAuthorizer(args.operatorRole)) {
    return { ok: true, authorizedById: args.operatorStaffId };
  }
  if (!args.pinProvided) {
    return { ok: false, status: 403, error: "La reimpresión la autoriza un Capitán o Manager." };
  }
  if (args.pinAuthorizedId == null) {
    return { ok: false, status: 403, error: "PIN incorrecto o sin permiso para autorizar la reimpresión." };
  }
  return { ok: true, authorizedById: args.pinAuthorizedId };
}

/** prepArea → impresora física (PrintTarget) al enviar a cocina/barra. */
export function prepAreaToTarget(prepArea: "BARRA" | "COCINA"): "BARRA" | "COCINA" {
  return prepArea; // 1:1 en B.1 (2 áreas). Si se subdividen áreas, se mapea aquí.
}

// ── División de cuenta (cuentas hijas) ───────────────────────────────────────

/**
 * Separador de las divisiones. Guion medio y no punto: un punto dentro de un
 * identificador termina interpretándose como separador decimal o de ruta en
 * algún punto de la cadena —hojas de cálculo, nombres de archivo, la propia
 * impresora— y "14.1" se convierte en 14,1 sin que nadie lo note.
 */
export const SPLIT_SEP = "-";

/**
 * Nombre de la siguiente cuenta hija.
 *
 * De "14" con hijas ["14-1","14-2"] sale "14-3". De "14-1" con hija ["14-1-1"]
 * sale "14-1-2". El nivel se lee de la propia etiqueta base, así que dividir una
 * división no necesita lógica aparte: es la misma operación aplicada otra vez.
 *
 * Se numera por el MAYOR sufijo existente y no por la cantidad de hijas: si la
 * 14-2 se cerró y desapareció de la lista, la siguiente debe seguir siendo 14-3.
 * Reciclar el 2 dejaría dos cuentas distintas con el mismo nombre en el turno.
 */
export function nextSplitLabel(baseLabel: string, takenLabels: readonly string[]): string {
  const prefix = `${baseLabel}${SPLIT_SEP}`;
  let max = 0;
  for (const label of takenLabels) {
    if (!label.startsWith(prefix)) continue;
    // Solo hijas DIRECTAS: "14-1-1" es nieta de "14" y no cuenta para su numeración.
    const rest = label.slice(prefix.length);
    if (!/^\d+$/.test(rest)) continue;
    const n = Number(rest);
    if (n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

/**
 * ¿Se puede dividir esta cuenta? Hace falta que queden al menos dos unidades:
 * dividir deja productos de un lado y del otro, y una cuenta que se queda vacía
 * no es una división sino un traspaso —que ya tiene su propia acción.
 */
export function canSplitAccount(args: {
  totalUnits: number;
  selectedUnits: number;
}): { ok: true } | { ok: false; error: string } {
  if (args.totalUnits < 2) {
    return { ok: false, error: "Hace falta al menos dos productos para dividir la cuenta." };
  }
  if (args.selectedUnits <= 0) {
    return { ok: false, error: "Elige al menos un producto para la cuenta nueva." };
  }
  if (args.selectedUnits >= args.totalUnits) {
    return { ok: false, error: "Deja al menos un producto en la cuenta original; para moverlo todo usa Traspasar." };
  }
  return { ok: true };
}
