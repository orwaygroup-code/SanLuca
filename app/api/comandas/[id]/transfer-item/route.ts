import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { verifySupervisorPin } from "@/lib/staff";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE, recalcComandaTotals } from "@/lib/comanda";
import { round2, lineTotal as calcLineTotal } from "@/lib/comandaTotals";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/transfer-item — traspasa un producto de la cuenta FROM
 * (:id) a otra. requireCashier + authPin de Capitán/Manager.
 * Body: { toComandaId, itemId, quantity?, authPin, reason? }
 * - quantity omitido = traspaso total del renglón. Parcial = divide el renglón
 *   (el descuento del producto se prorratea por unidad). recalc ambas.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const fromId = parseId(params.id);
  if (!fromId) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const toId = parseId(String(body?.toComandaId));
  const itemId = parseId(String(body?.itemId));
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;
  const authPin = typeof body?.authPin === "string" ? body.authPin : "";
  if (!toId || !itemId) return NextResponse.json<ApiResponse>({ success: false, error: "toComandaId e itemId son obligatorios" }, { status: 400 });
  if (toId === fromId) return NextResponse.json<ApiResponse>({ success: false, error: "El destino debe ser otra cuenta" }, { status: 400 });

  const authorizedById = await verifySupervisorPin(authPin, { tenantId: TENANT });
  if (!authorizedById) {
    return NextResponse.json<ApiResponse>({ success: false, error: "PIN de supervisor inválido (Capitán/Manager)" }, { status: 403 });
  }

  const [from, to] = await Promise.all([
    prisma.comanda.findFirst({ where: { id: fromId, tenantId: TENANT }, select: { id: true, status: true } }),
    prisma.comanda.findFirst({ where: { id: toId, tenantId: TENANT }, select: { id: true, status: true } }),
  ]);
  if (!from) return NextResponse.json<ApiResponse>({ success: false, error: "Cuenta origen no encontrada" }, { status: 404 });
  if (!to) return NextResponse.json<ApiResponse>({ success: false, error: "Cuenta destino no encontrada" }, { status: 404 });
  for (const [c, label] of [[from, "origen"], [to, "destino"]] as const) {
    if (!ACTIVE_STATUSES.includes(c.status as (typeof ACTIVE_STATUSES)[number])) {
      return NextResponse.json<ApiResponse>({ success: false, error: `Cuenta ${label} ${c.status}: no admite traspaso` }, { status: 409 });
    }
  }

  const item = await prisma.comandaItem.findFirst({
    where: { id: itemId, comandaId: fromId, tenantId: TENANT },
    select: {
      id: true, status: true, dishId: true, dishNameSnapshot: true, unitPriceSnapshot: true,
      prepAreaSnapshot: true, quantity: true, modifiers: true, modifiersExtraCost: true,
      kitchenNotes: true, discountAmount: true,
    },
  });
  if (!item) return NextResponse.json<ApiResponse>({ success: false, error: "Producto no encontrado en la cuenta origen" }, { status: 404 });
  if (item.status === "CANCELLED") return NextResponse.json<ApiResponse>({ success: false, error: "El producto está cancelado" }, { status: 409 });

  const itemQty = Number(item.quantity);
  const qty = body?.quantity != null ? Math.round(Number(body.quantity) * 100) / 100 : itemQty;
  // Permite traspasar el renglón COMPLETO (aunque sea fraccional, p.ej. 0.5) o una
  // cantidad ENTERA parcial. No fracciona un renglón en fracciones más chicas.
  if (!(qty > 0) || qty > itemQty || (!Number.isInteger(qty) && qty !== itemQty)) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Cantidad a traspasar inválida (1–${itemQty})` }, { status: 400 });
  }

  const unitPrice = Number(item.unitPriceSnapshot);
  const modExtra = Number(item.modifiersExtraCost);
  const movedDiscount = round2((Number(item.discountAmount) * qty) / itemQty);
  const movedLineTotal = calcLineTotal(unitPrice, qty, modExtra);

  const ops =
    qty === itemQty
      ? [
          // Traspaso total: reasigna el renglón completo.
          prisma.comandaItem.update({ where: { id: itemId }, data: { comandaId: toId } }),
        ]
      : [
          // Traspaso parcial: reduce el origen y crea un renglón nuevo en destino.
          prisma.comandaItem.update({
            where: { id: itemId },
            data: {
              quantity: round2(itemQty - qty),
              lineTotal: calcLineTotal(unitPrice, round2(itemQty - qty), modExtra),
              discountAmount: round2(Number(item.discountAmount) - movedDiscount),
            },
          }),
          prisma.comandaItem.create({
            data: {
              tenantId: TENANT,
              comandaId: toId,
              dishId: item.dishId,
              dishNameSnapshot: item.dishNameSnapshot,
              unitPriceSnapshot: item.unitPriceSnapshot,
              prepAreaSnapshot: item.prepAreaSnapshot,
              quantity: qty,
              lineTotal: movedLineTotal,
              discountAmount: movedDiscount,
              modifiers: item.modifiers,
              modifiersExtraCost: item.modifiersExtraCost,
              kitchenNotes: item.kitchenNotes,
              status: item.status,
              addedById: a.staffId,
            },
          }),
        ];

  await prisma.$transaction([
    ...ops,
    prisma.comandaItemTransfer.create({
      data: {
        tenantId: TENANT,
        fromComandaId: fromId,
        toComandaId: toId,
        dishNameSnapshot: item.dishNameSnapshot,
        quantity: qty,
        lineTotalSnapshot: movedLineTotal,
        movedById: authorizedById,
        reason,
      },
    }),
  ]);

  await Promise.all([recalcComandaTotals(fromId), recalcComandaTotals(toId)]);

  const [fromUpd, toUpd] = await Promise.all([
    prisma.comanda.findFirst({ where: { id: fromId, tenantId: TENANT }, include: COMANDA_INCLUDE }),
    prisma.comanda.findFirst({ where: { id: toId, tenantId: TENANT }, include: COMANDA_INCLUDE }),
  ]);
  return NextResponse.json<ApiResponse>({ success: true, data: { from: fromUpd, to: toUpd } });
}
