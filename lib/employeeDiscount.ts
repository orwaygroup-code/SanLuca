import { prisma } from "@/lib/prisma";
import { TENANT, ACTIVE_STATUSES, recalcComandaTotals, EMPLOYEE_DISCOUNT_REASON } from "@/lib/comanda";
import { round2, computeDiscountAmount } from "@/lib/comandaTotals";

/**
 * Descuento de empleado (scope BILL). Movido en la Ola 7c desde la antigua ruta de
 * descuento de empleado (ya borrada): mismos cálculos y misma transacción, ahora
 * reutilizable desde link-employee y print.
 *
 * El porcentaje es una política fija del negocio (RestaurantSettings), no una
 * decisión discrecional del cajero, así que no pide PIN de supervisor.
 */

export async function employeePercent(): Promise<number> {
  const s = await prisma.restaurantSettings.findUnique({
    where: { tenantId: TENANT },
    select: { employeeDiscountPercent: true },
  });
  const pct = Number(s?.employeeDiscountPercent ?? 0);
  return Number.isFinite(pct) && pct > 0 && pct <= 100 ? pct : 0;
}

/**
 * Aplica (o reemplaza) el descuento de empleado sobre una comanda. NUNCA lanza;
 * idempotente (reaplicar recalcula sobre la base actual). Devuelve:
 *  - "none": no hay política (pct<=0), la cuenta no está activa, ya tiene pagos, o
 *     no hay base que descontar (cuenta recién creada, sin productos — el descuento
 *     se aplicará al imprimir).
 *  - "supervisor": hay un descuento BILL vigente que NO es de empleado → no lo toca.
 *  - "applied": lo aplicó o reemplazó.
 * Sin `notify`: lo hace la ruta que llama.
 */
export async function applyEmployeeDiscount(
  comandaId: number,
  authorizedById: number,
): Promise<"applied" | "none" | "supervisor"> {
  const pct = await employeePercent();
  if (pct <= 0) return "none";

  const comanda = await prisma.comanda.findFirst({
    where: { id: comandaId, tenantId: TENANT },
    select: {
      id: true,
      status: true,
      amountPaid: true,
      items: { where: { status: { not: "CANCELLED" } }, select: { lineTotal: true, discountAmount: true } },
    },
  });
  if (!comanda) return "none";
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) return "none";
  // Con pagos parciales el descuento cambiaría la base bajo los pies de lo ya cobrado.
  if (Number(comanda.amountPaid) > 0.005) return "none";

  const base = round2(
    comanda.items.reduce((s, i) => s + Math.max(0, round2(Number(i.lineTotal) - Number(i.discountAmount))), 0),
  );
  if (base <= 0) return "none";

  const amount = round2(Math.min(computeDiscountAmount(base, "PERCENT", pct), base));
  if (amount <= 0) return "none";

  // No pisar un descuento que un supervisor autorizó a mano: solo se reemplaza el de
  // empleado (su reason empieza con EMPLOYEE_DISCOUNT_REASON).
  const vigente = await prisma.comandaDiscount.findFirst({
    where: { comandaId, tenantId: TENANT, scope: "BILL" },
    select: { reason: true },
  });
  if (vigente && !vigente.reason.startsWith(EMPLOYEE_DISCOUNT_REASON)) return "supervisor";

  await prisma.$transaction([
    prisma.comandaDiscount.deleteMany({ where: { comandaId, tenantId: TENANT, scope: "BILL" } }),
    prisma.comandaDiscount.create({
      data: {
        tenantId: TENANT,
        comandaId,
        scope: "BILL",
        type: "PERCENT",
        value: pct,
        amount,
        reason: `${EMPLOYEE_DISCOUNT_REASON} (${pct}%)`,
        authorizedById,
      },
    }),
    prisma.comanda.update({ where: { id: comandaId }, data: { discountTotal: amount } }),
  ]);
  await recalcComandaTotals(comandaId);
  return "applied";
}

/** Retira el descuento de empleado (solo el que puso esta lógica, por su reason). */
export async function removeEmployeeDiscount(comandaId: number): Promise<void> {
  const mine = await prisma.comandaDiscount.findFirst({
    where: { comandaId, tenantId: TENANT, scope: "BILL", reason: { startsWith: EMPLOYEE_DISCOUNT_REASON } },
    select: { id: true },
  });
  if (mine) {
    await prisma.$transaction([
      prisma.comandaDiscount.delete({ where: { id: mine.id } }),
      prisma.comanda.update({ where: { id: comandaId }, data: { discountTotal: 0 } }),
    ]);
    await recalcComandaTotals(comandaId);
  }
}
