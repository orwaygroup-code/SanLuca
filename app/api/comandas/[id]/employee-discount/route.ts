import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT, COMANDA_INCLUDE, ACTIVE_STATUSES, recalcComandaTotals } from "@/lib/comanda";
import { round2, computeDiscountAmount } from "@/lib/comandaTotals";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/employee-discount — aplica el descuento de empleado
 * configurado en Ajustes (RestaurantSettings.employeeDiscountPercent).
 * DELETE — lo retira (al cambiar de empleado o cancelar el cobro a crédito).
 *
 * Por qué no se reutiliza /api/comandas/:id/discount:
 *
 *  - Aquel exige isEditableStatus, y cobrar a crédito de personal requiere la
 *    cuenta YA IMPRESA, momento en que pasa a AWAITING_PAYMENT y queda
 *    bloqueada. Los dos requisitos son incompatibles, y por eso este descuento
 *    nunca llegó a automatizarse.
 *  - Aquel pide PIN de un supervisor porque es discrecional. Este no lo es: el
 *    porcentaje es una política fija que el admin define en Ajustes, así que la
 *    autorización es la del cajero que ya está operando.
 *
 * Comparte con aquel el modelo: descuento scope BILL, que REEMPLAZA al anterior
 * en vez de acumularse. Reaplicarlo es idempotente.
 */

const DISCOUNT_REASON = "Descuento de empleado";

async function employeePercent(): Promise<number> {
  const s = await prisma.restaurantSettings.findUnique({
    where: { tenantId: TENANT },
    select: { employeeDiscountPercent: true },
  });
  const pct = Number(s?.employeeDiscountPercent ?? 0);
  return Number.isFinite(pct) && pct > 0 && pct <= 100 ? pct : 0;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });
  if (a.staffId == null) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado" }, { status: 409 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  // Sin porcentaje configurado no hay error: es un estado válido (el negocio
  // decidió no dar descuento). Se devuelve la cuenta intacta para no
  // interrumpir el cobro con un mensaje que el cajero no puede resolver.
  const pct = await employeePercent();
  if (pct <= 0) {
    const asIs = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
    return NextResponse.json<ApiResponse>({ success: true, data: asIs });
  }

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: {
      id: true,
      status: true,
      amountPaid: true,
      items: { where: { status: { not: "CANCELLED" } }, select: { lineTotal: true, discountAmount: true } },
    },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: no admite descuento` }, { status: 409 });
  }
  // Con pagos parciales el descuento cambiaría la base bajo los pies de lo ya
  // cobrado. Se exige cuenta sin pagos, igual que link-employee.
  if (Number(comanda.amountPaid) > 0.005) {
    return NextResponse.json<ApiResponse>({ success: false, error: "La cuenta ya tiene pagos; no se puede aplicar el descuento de empleado" }, { status: 409 });
  }

  const base = round2(
    comanda.items.reduce((s, i) => s + Math.max(0, round2(Number(i.lineTotal) - Number(i.discountAmount))), 0),
  );
  if (base <= 0) return NextResponse.json<ApiResponse>({ success: false, error: "No hay saldo para descontar" }, { status: 409 });

  const amount = round2(Math.min(computeDiscountAmount(base, "PERCENT", pct), base));
  if (amount <= 0) return NextResponse.json<ApiResponse>({ success: false, error: "El descuento resulta en $0" }, { status: 400 });

  await prisma.$transaction([
    prisma.comandaDiscount.deleteMany({ where: { comandaId: id, tenantId: TENANT, scope: "BILL" } }),
    prisma.comandaDiscount.create({
      data: {
        tenantId: TENANT,
        comandaId: id,
        scope: "BILL",
        type: "PERCENT",
        value: pct,
        amount,
        reason: `${DISCOUNT_REASON} (${pct}%)`,
        authorizedById: a.staffId,
      },
    }),
    prisma.comanda.update({ where: { id }, data: { discountTotal: amount } }),
  ]);
  await recalcComandaTotals(id);

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}

/** Retira el descuento de empleado (sólo si es el que puso esta ruta). */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  // Sólo retira SU descuento: si un supervisor puso otro a mano, no se toca.
  const mine = await prisma.comandaDiscount.findFirst({
    where: { comandaId: id, tenantId: TENANT, scope: "BILL", reason: { startsWith: DISCOUNT_REASON } },
    select: { id: true },
  });
  if (mine) {
    await prisma.$transaction([
      prisma.comandaDiscount.delete({ where: { id: mine.id } }),
      prisma.comanda.update({ where: { id }, data: { discountTotal: 0 } }),
    ]);
    await recalcComandaTotals(id);
  }

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
