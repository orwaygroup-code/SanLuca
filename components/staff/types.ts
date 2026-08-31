/**
 * Tipos del lado cliente para las vistas de Comandas (Fase B.2). Reflejan lo que
 * devuelven los endpoints con COMANDA_INCLUDE. Los Decimal de Prisma llegan como
 * string en JSON — por eso los montos son number | string (Number() los normaliza).
 */

export type ComandaStatus =
  | "OPEN" | "IN_SERVICE" | "AWAITING_PAYMENT" | "PARTIALLY_PAID" | "PAID" | "MERGED" | "CANCELLED";
export type ItemStatus = "PENDING" | "SENT" | "IN_PREP" | "READY" | "SERVED" | "DELIVERED" | "CANCELLED";
export type PrepArea = "BARRA" | "COCINA";
export type PaymentMethod = "CASH" | "CARD_DEBIT" | "CARD_CREDIT" | "TRANSFER" | "WAITER_CREDIT";

export interface CItem {
  id: number;
  dishId: string;
  dishNameSnapshot: string;
  unitPriceSnapshot: number | string;
  prepAreaSnapshot: PrepArea;
  quantity: number | string; // Decimal — puede ser fraccional (0.5, 1.5). Usar Number().
  course: number; // "tiempo" del platillo (1º, 2º…) — agrupa/separa en el ticket
  modifiers: string | null;
  modifiersExtraCost: number | string;
  kitchenNotes: string | null;
  lineTotal: number | string;
  discountAmount: number | string;
  status: ItemStatus;
  addedAt: string;
  sentAt: string | null;
  comments?: CItemComment[]; // bitácora append-only por producto
}

export interface CItemComment {
  id: number;
  text: string;
  createdById: number | null;
  createdAt: string;
}

export interface CPrint {
  id: number;
  type: "KITCHEN_BAR" | "KITCHEN_CANCEL" | "KITCHEN_REPRINT" | "CUSTOMER_FINAL" | "CUSTOMER_REPRINT";
  target: string;
  printedAt: string;
  authorizationReason: string | null;
}

export interface CTableRef { id: string; number: number; section: { name: string } }
export interface CWaiterRef { id: number; fullName: string; username: string; role: string }

export interface Comanda {
  id: number;
  folio: string;
  status: ComandaStatus;
  guestsActual: number;
  shift: string;
  notes: string | null;
  subtotal: number | string;
  taxAmount: number | string;
  total: number | string;
  amountPaid: number | string;
  tipTotal: number | string;
  discountTotal: number | string;
  reopenCount: number;
  cashSessionId: number | null;
  openedAt: string;
  awaitingPaymentAt?: string | null; // cuándo pasó a "por pagar" (alerta al mesero tras 1h)
  closedAt: string | null;
  tableId: string | null;
  customName: string | null; // nombre de la cuenta cuando no hay mesa (para llevar / cuenta X)
  channel?: string; // "STAFF" (Perla) | "BOT_WHATSAPP"|"BOT_INSTAGRAM"|"BOT_MESSENGER" (pedido del bot)
  pickupNote?: string | null; // cuándo pasa el cliente por el pedido del bot (ej. "4 ago · 2:00 PM")
  waiterId: number;
  reservationId: string | null;
  items: CItem[];
  prints: CPrint[];
  reopens?: { reopenedAt: string }[]; // última reapertura primero; para saber si se imprimió DESPUÉS de reabrir
  table: CTableRef | null;
  waiter: CWaiterRef;
  // #4 Ligar a empleado (cuenta a crédito con aprobación previa del empleado)
  chargedEmployeeId?: number | null;
  employeeChargeStatus?: "PENDING" | "APPROVED" | null;
  employeeChargeApprovedAt?: string | null;
  chargedEmployee?: { id: number; fullName: string; role: string } | null;

  /** División de cuenta: "14-1" si nació de partir la 14; null si es una cuenta normal. */
  splitLabel?: string | null;
  parentComandaId?: number | null;
}

/**
 * ¿La cuenta tiene un ticket de cliente VIGENTE? = hay un CUSTOMER_FINAL emitido DESPUÉS de
 * la última reapertura. Al reabrir la cuenta el candado se reinicia: se puede volver a
 * modificar e imprimir; al reimprimir se vuelve a cerrar (solo Cobrar). Fuente única de la
 * regla "impreso → solo Cobrar" para el detalle y las listas de operación.
 */
export function isBillPrinted(c: { prints?: CPrint[]; reopens?: { reopenedAt: string }[] }): boolean {
  const lastFinal = (c.prints ?? [])
    .filter((p) => p.type === "CUSTOMER_FINAL")
    .reduce((max, p) => Math.max(max, new Date(p.printedAt).getTime()), 0);
  if (!lastFinal) return false;
  const lastReopen = c.reopens?.[0]?.reopenedAt ? new Date(c.reopens[0].reopenedAt).getTime() : 0;
  return lastFinal > lastReopen;
}

/**
 * Etiqueta corta de una comanda: "Mesa 5", "Mesa 14-1" si es una división, o el
 * nombre de la cuenta sin mesa.
 *
 * splitLabel manda sobre el número de mesa: una cuenta dividida sigue en la
 * misma mesa, así que sin esto la 14 y la 14-1 se verían idénticas en el piso.
 */
export function comandaLabel(c: { table: CTableRef | null; customName?: string | null; splitLabel?: string | null }): string {
  if (c.splitLabel) return c.table ? `Mesa ${c.splitLabel}` : c.splitLabel;
  if (c.table) return `Mesa ${c.table.number}`;
  return (c.customName && c.customName.trim()) || "Cuenta sin mesa";
}

// ── Caja / POS ──────────────────────────────────────────────────────────────

export interface CutMethodRow { method: PaymentMethod; count: number; amount: number; tip: number }

export interface CutSnapshot {
  sessionId: number;
  folio: string;
  shift: string | null;
  openingFloat: number;
  byMethod: CutMethodRow[];
  totalCollected: number;
  totalTips: number;
  cashCollected: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  paymentsCount: number;
  comandasSettled: number;
  generatedAt: string;
}

export interface StaffRef { id: number; fullName: string; username: string }

export interface CashSession {
  id: number;
  folio: string;
  status: "OPEN" | "CLOSED";
  shift: string | null;
  openingFloat: number | string;
  expectedCash: number | string | null;
  countedCash: number | string | null;
  difference: number | string | null;
  openedById: number;
  closedById: number | null;
  openedBy?: StaffRef | null;
  closedBy?: StaffRef | null;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
}

/** Respuesta de POST /api/comandas/:id/pay */
export interface PayResult {
  comanda: Comanda;
  settled: boolean;
  amountPaid: number;
  remaining: number;
  changeGiven: number;
}

// ── Reparto de propinas / Puntos ─────────────────────────────────────────────

export interface TipArea { name: string; percent: number }
export interface TipPolicy { pointPercent: number; areas: TipArea[] }

export interface WaiterBase {
  waiterId: number;
  fullName: string;
  salesTotal: number | string;
  tipsRegistered: number | string;
}

export interface TipSettlementWaiterRow {
  waiterId: number;
  salesTotal: number | string;
  tipsRegistered: number | string;
  cashTipsDeclared: number | string;
  pointPercent: number | string;
  deduction: number | string;
  netTip: number | string;
  waiter?: { fullName: string };
}

export interface TipSettlement {
  id: number;
  cashSessionId: number;
  pointPercent: number | string;
  salesTotal: number | string;
  tipsRegistered: number | string;
  cashTipsDeclared: number | string;
  poolTotal: number | string;
  notes: string | null;
  createdAt: string;
  waiters: TipSettlementWaiterRow[];
  areas: { name: string; percent: number | string; amount: number | string }[];
}

export interface TipsCurrent {
  session: CashSession | null;
  base?: WaiterBase[];
  saved?: TipSettlement | null;
  policy?: TipPolicy;
}

export interface TableStatus {
  id: string;
  number: number;
  capacity: number;
  section: string;
  state: ComandaStatus | "FREE";
  comanda: { id: number; folio: string; status: ComandaStatus; total: number; guests: number; waiter: { id: number; fullName: string } | null; billPrinted: boolean } | null;
}

export interface ReservationToday {
  id: string;
  guestName: string;
  guestPhone: string | null;
  date: string;
  guests: number;
  status: string;
  sectionPreference: string | null;
  tableId: string | null;
  table: { id: string; number: number; section: { name: string } } | null;
  comanda: { id: number; folio: string; status: ComandaStatus } | null;
}

/** Helper fetch JSON con manejo del wrapper ApiResponse. */
export async function apiFetch<T = unknown>(
  url: string,
  opts?: RequestInit,
): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  try {
    const r = await fetch(url, { credentials: "same-origin", ...opts });
    const body = await r.json().catch(() => null);
    if (!r.ok || !body?.success) {
      return { ok: false, error: body?.error ?? `Error ${r.status}`, status: r.status };
    }
    return { ok: true, data: body.data as T, status: r.status };
  } catch {
    return { ok: false, error: "Error de red", status: 0 };
  }
}
