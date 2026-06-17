import { prisma } from "./prisma";
import { computeTotals, type TaxSettings } from "./comandaTotals";

/**
 * Servicio de Comandas (Fase B.1). Usa el cliente admin `prisma` (BYPASSRLS):
 * los modelos de comandas viven en el realm de Staff, sin policies RLS — mismo
 * patrón que Fase 0. Toda query filtra `tenantId: 1` (multi-tenant ready).
 */

export const TENANT = 1;

/** Estados de comanda considerados "activos" (en el piso). */
export const ACTIVE_STATUSES = ["OPEN", "IN_SERVICE", "AWAITING_PAYMENT"] as const;

/** Include estándar para devolver una comanda con su detalle. */
export const COMANDA_INCLUDE = {
  items: { orderBy: { addedAt: "asc" } },
  prints: { orderBy: { printedAt: "asc" } },
  table: { select: { id: true, number: true, section: { select: { name: true } } } },
  waiter: { select: { id: true, fullName: true, username: true, role: true } },
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
  const items = await prisma.comandaItem.findMany({
    where: { comandaId, tenantId: TENANT, status: { not: "CANCELLED" } },
    select: { lineTotal: true },
  });
  const settings = await loadTaxSettings();
  const totals = computeTotals(items.map((i) => Number(i.lineTotal)), settings);
  return prisma.comanda.update({
    where: { id: comandaId },
    data: { subtotal: totals.subtotal, taxAmount: totals.taxAmount, total: totals.total },
  });
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
