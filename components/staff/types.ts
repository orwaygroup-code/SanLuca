/**
 * Tipos del lado cliente para las vistas de Comandas (Fase B.2). Reflejan lo que
 * devuelven los endpoints con COMANDA_INCLUDE. Los Decimal de Prisma llegan como
 * string en JSON — por eso los montos son number | string (Number() los normaliza).
 */

export type ComandaStatus =
  | "OPEN" | "IN_SERVICE" | "AWAITING_PAYMENT" | "PARTIALLY_PAID" | "PAID" | "MERGED" | "CANCELLED";
export type ItemStatus = "PENDING" | "SENT" | "READY" | "SERVED" | "CANCELLED";
export type PrepArea = "BARRA" | "COCINA";
export type PaymentMethod = "CASH" | "CARD_DEBIT" | "CARD_CREDIT" | "TRANSFER";

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
}

export interface CPrint {
  id: number;
  type: "KITCHEN_BAR" | "CUSTOMER_FINAL" | "CUSTOMER_REPRINT";
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
  closedAt: string | null;
  tableId: string;
  waiterId: number;
  reservationId: string | null;
  items: CItem[];
  prints: CPrint[];
  table: CTableRef;
  waiter: CWaiterRef;
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

export interface TableStatus {
  id: string;
  number: number;
  capacity: number;
  section: string;
  state: ComandaStatus | "FREE";
  comanda: { id: number; folio: string; status: ComandaStatus; total: number; guests: number; waiter: { id: number; fullName: string } | null } | null;
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
