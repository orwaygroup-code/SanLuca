import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { computeTotals, round2, type TaxSettings } from "./comandaTotals";

type Db = typeof prisma | Prisma.TransactionClient;

/**
 * Servicio de Comandas (Fase B.1). Usa el cliente admin `prisma` (BYPASSRLS):
 * los modelos de comandas viven en el realm de Staff, sin policies RLS — mismo
 * patrón que Fase 0. Toda query filtra `tenantId: 1` (multi-tenant ready).
 */

export const TENANT = 1;

/**
 * Encola un pulso de apertura de cajón para el PrintBridge de CAJA. No imprime
 * papel: crea un ComandaPrint DRAWER_KICK con payload {kind:"drawer"} que el
 * bridge convierte en el comando ESC/POS que abre el cajón. `comandaId` es
 * opcional (corte / botón manual no traen comanda). Fire-and-forget: si algo
 * falla, se loguea y NO tumba la acción principal (cobro, corte, etc.).
 */
export async function enqueueDrawerKick(
  args: { staffId: number; comandaId?: number | null },
  db: Db = prisma,
): Promise<void> {
  try {
    await db.comandaPrint.create({
      data: {
        tenantId: TENANT,
        comandaId: args.comandaId ?? null,
        type: "DRAWER_KICK",
        target: "CAJA",
        executedById: args.staffId,
        status: "PENDING",
        payload: { kind: "drawer" },
      },
    });
  } catch (e) {
    console.error("[DRAWER] no se pudo encolar apertura de cajón:", e);
  }
}

/** Estados de comanda considerados "activos" (en el piso). Incluye
 *  PARTIALLY_PAID: sigue ocupando la mesa mientras se cobra por partes. */
export const ACTIVE_STATUSES = ["OPEN", "IN_SERVICE", "AWAITING_PAYMENT", "PARTIALLY_PAID"] as const;

/**
 * Estados en los que la cuenta SÍ se puede modificar (agregar/cancelar productos, descuentos,
 * traspaso, merge, cancelar la cuenta). En cuanto se imprime el ticket / se manda a caja la
 * cuenta pasa a AWAITING_PAYMENT (bloqueada): hay que REABRIRLA (unlock → IN_SERVICE) antes
 * de tocarla. Regla de negocio de Paul: nada de cancelar/modificar una cuenta impresa sin
 * reabrirla primero.
 */
export const EDITABLE_STATUSES = ["OPEN", "IN_SERVICE"] as const;
export function isEditableStatus(status: string): boolean {
  return (EDITABLE_STATUSES as readonly string[]).includes(status);
}
/** Mensaje único cuando se intenta modificar una cuenta ya bloqueada (por cobrar / pagada). */
export const LOCKED_ACCOUNT_MSG = "La cuenta ya está impresa / por cobrar. Reábrela para poder modificarla o cancelarla.";

/** Include estándar para devolver una comanda con su detalle. */
export const COMANDA_INCLUDE = {
  items: { orderBy: { addedAt: "asc" }, include: { comments: { orderBy: { createdAt: "asc" } } } },
  prints: { orderBy: { printedAt: "asc" } },
  table: { select: { id: true, number: true, section: { select: { name: true } } } },
  waiter: { select: { id: true, fullName: true, username: true, role: true } },
  chargedEmployee: { select: { id: true, fullName: true, role: true } }, // #4 empleado ligado (crédito)
} as const;

/** Lee la config de IVA del tenant (default IVA 16% activo si no hay fila). */
export async function loadTaxSettings(): Promise<TaxSettings> {
  const s = await prisma.restaurantSettings.findUnique({ where: { tenantId: TENANT } });
  return { taxEnabled: s?.taxEnabled ?? true, taxRate: s ? Number(s.taxRate) : 0.16 };
}

/**
 * Recalcula y persiste subtotal/taxAmount/total de la comanda desde sus items
 * NO cancelados. Se llama tras agregar o cancelar un item.
 */
export async function recalcComandaTotals(comandaId: number) {
  const [items, comanda] = await Promise.all([
    prisma.comandaItem.findMany({
      where: { comandaId, tenantId: TENANT, status: { not: "CANCELLED" } },
      select: { lineTotal: true, discountAmount: true },
    }),
    prisma.comanda.findUnique({ where: { id: comandaId }, select: { discountTotal: true } }),
  ]);
  const settings = await loadTaxSettings();
  // 1) descuento POR PRODUCTO: se resta a cada línea. 2) descuento A LA CUENTA:
  // se resta al bruto. El resultado (bruto ya con IVA) se pasa a computeTotals,
  // que hace el desglose de IVA hacia atrás (los precios incluyen IVA).
  const grossLines = items.map((i) => Math.max(0, round2(Number(i.lineTotal) - Number(i.discountAmount))));
  const gross = Math.max(0, round2(grossLines.reduce((s, x) => s + x, 0) - Number(comanda?.discountTotal ?? 0)));
  const totals = computeTotals([gross], settings);
  return prisma.comanda.update({
    where: { id: comandaId },
    data: { subtotal: totals.subtotal, taxAmount: totals.taxAmount, total: totals.total },
  });
}

/**
 * Marca una comanda PAID (terminal) + closedAt/closedById + sesión de caja
 * opcional. Seguro dentro de `$transaction`. La reserva ligada se completa
 * aparte con `completeLinkedReservation` (best-effort, fuera de la tx).
 * Compartido por los endpoints `close` (cierre sin cobro) y `pay` (al liquidar).
 */
export async function settleComanda(
  db: Db,
  comandaId: number,
  closedById: number,
  cashSessionId?: number | null,
) {
  await db.comanda.update({
    where: { id: comandaId },
    data: {
      status: "PAID",
      closedAt: new Date(),
      closedById,
      ...(cashSessionId ? { cashSessionId } : {}),
    },
  });
}

/** Si la comanda tenía reserva ligada, la marca COMPLETED. Best-effort, fuera de tx. */
export async function completeLinkedReservation(comandaId: number) {
  const c = await prisma.comanda.findUnique({ where: { id: comandaId }, select: { reservationId: true } });
  if (!c?.reservationId) return;
  await prisma.reservation
    .update({ where: { id: c.reservationId }, data: { status: "COMPLETED", checkedInAt: new Date() } })
    .catch((e) => console.error("[Comandas] no se pudo completar la reserva:", e));
}

/** ¿El error de Prisma es violación de unique constraint (P2002)? */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

/**
 * Campos objetivo de una violación de unique (P2002), normalizados a un string
 * en minúsculas. Sirve para distinguir CUÁL constraint chocó (folio vs
 * reservationId). El formato de `meta.target` varía entre versiones de Prisma
 * (array de columnas o nombre de constraint), por eso se normaliza a texto.
 */
export function uniqueViolationTarget(e: unknown): string {
  if (typeof e !== "object" || e === null) return "";
  const target = (e as { meta?: { target?: unknown } }).meta?.target;
  if (Array.isArray(target)) return target.map(String).join(",").toLowerCase();
  return typeof target === "string" ? target.toLowerCase() : "";
}
