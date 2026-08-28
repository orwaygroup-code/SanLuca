import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { verifySupervisorPin } from "@/lib/staff";
import { TENANT, COMANDA_INCLUDE, recalcComandaTotals, isEditableStatus, LOCKED_ACCOUNT_MSG } from "@/lib/comanda";
import { notify } from "@/lib/notify";
import { round2, computeDiscountAmount } from "@/lib/comandaTotals";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/items/:itemId/discount — descuento POR PRODUCTO (scope ITEM).
 * requireCashier + authPin de Capitán/Manager. Body: { type, value, reason, authPin }
 * Acota al saldo del renglón (lineTotal − discountAmount). recalc redesglosa IVA.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });

  const id = parseId(params.id);
  const itemId = parseId(params.itemId);
  if (!id || !itemId) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const type = body?.type === "PERCENT" || body?.type === "FIXED" ? body.type : null;
  const value = round2(Number(body?.value));
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const authPin = typeof body?.authPin === "string" ? body.authPin : "";
  if (!type || !Number.isFinite(value) || value <= 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "type/value inválidos" }, { status: 400 });
  }
  if (!reason) return NextResponse.json<ApiResponse>({ success: false, error: "El motivo es obligatorio" }, { status: 400 });

  const authorizedById = await verifySupervisorPin(authPin, { tenantId: TENANT, roles: ["OPERATION", "CAPTAIN", "MANAGER"] });
  if (!authorizedById) {
    return NextResponse.json<ApiResponse>({ success: false, error: "PIN inválido (Operación/Capitán/Manager)" }, { status: 403 });
  }

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, status: true },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (!isEditableStatus(comanda.status)) {
    const locked = comanda.status === "AWAITING_PAYMENT" || comanda.status === "PARTIALLY_PAID";
    return NextResponse.json<ApiResponse>({ success: false, error: locked ? LOCKED_ACCOUNT_MSG : `Comanda ${comanda.status}: no admite descuento` }, { status: 409 });
  }

  const item = await prisma.comandaItem.findFirst({
    where: { id: itemId, comandaId: id, tenantId: TENANT },
    select: { id: true, status: true, lineTotal: true, discountAmount: true },
  });
  if (!item) return NextResponse.json<ApiResponse>({ success: false, error: "Producto no encontrado en la cuenta" }, { status: 404 });
  if (item.status === "CANCELLED") {
    return NextResponse.json<ApiResponse>({ success: false, error: "El producto está cancelado" }, { status: 409 });
  }

  const lineTotal = round2(Number(item.lineTotal));
  const currentDiscount = round2(Number(item.discountAmount));
  const room = round2(lineTotal - currentDiscount);
  if (room <= 0) return NextResponse.json<ApiResponse>({ success: false, error: "No hay saldo para descontar en este producto" }, { status: 409 });

  const amount = round2(Math.min(computeDiscountAmount(lineTotal, type, value), room));
  if (amount <= 0) return NextResponse.json<ApiResponse>({ success: false, error: "El descuento resulta en $0" }, { status: 400 });

  await prisma.$transaction([
    prisma.comandaDiscount.create({
      data: { tenantId: TENANT, comandaId: id, scope: "ITEM", itemId, type, value, amount, reason, authorizedById },
    }),
    prisma.comandaItem.update({ where: { id: itemId }, data: { discountAmount: round2(currentDiscount + amount) } }),
  ]);
  await recalcComandaTotals(id);

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  void notify({ roles: ["MANAGER"], type: "audit", title: "Descuento a producto", body: `${updated?.folio ?? `#${id}`}`, url: "/admin/comandas" });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
