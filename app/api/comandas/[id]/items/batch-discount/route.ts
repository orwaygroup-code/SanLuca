import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { verifySupervisorPin } from "@/lib/staff";
import { TENANT, COMANDA_INCLUDE, recalcComandaTotals, isEditableStatus, LOCKED_ACCOUNT_MSG } from "@/lib/comanda";
import { round2, computeDiscountAmount } from "@/lib/comandaTotals";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/items/batch-discount { itemIds:number[], type, value, reason, authPin }
 * Aplica el MISMO descuento (PERCENT o FIXED) a cada producto seleccionado, acotado al saldo
 * de cada renglón. requireCashier + un solo PIN de supervisor para todo el lote.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const itemIds: number[] = Array.isArray(body?.itemIds) ? body.itemIds.filter((n: unknown) => Number.isInteger(n)) : [];
  const type = body?.type === "PERCENT" || body?.type === "FIXED" ? body.type : null;
  const value = round2(Number(body?.value));
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const authPin = typeof body?.authPin === "string" ? body.authPin : "";
  if (itemIds.length === 0) return NextResponse.json<ApiResponse>({ success: false, error: "Elige al menos un producto" }, { status: 400 });
  if (!type || !Number.isFinite(value) || value <= 0) return NextResponse.json<ApiResponse>({ success: false, error: "type/value inválidos" }, { status: 400 });
  if (!reason) return NextResponse.json<ApiResponse>({ success: false, error: "El motivo es obligatorio" }, { status: 400 });

  const authorizedById = await verifySupervisorPin(authPin, { tenantId: TENANT, roles: ["OPERATION", "CAPTAIN", "MANAGER"] });
  if (!authorizedById) return NextResponse.json<ApiResponse>({ success: false, error: "PIN inválido (Operación/Capitán/Manager)" }, { status: 403 });

  const comanda = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, select: { id: true, status: true } });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (!isEditableStatus(comanda.status)) {
    const locked = comanda.status === "AWAITING_PAYMENT" || comanda.status === "PARTIALLY_PAID";
    return NextResponse.json<ApiResponse>({ success: false, error: locked ? LOCKED_ACCOUNT_MSG : `Comanda ${comanda.status}: no admite descuento` }, { status: 409 });
  }

  const items = await prisma.comandaItem.findMany({
    where: { id: { in: itemIds }, comandaId: id, tenantId: TENANT, status: { not: "CANCELLED" } },
    select: { id: true, lineTotal: true, discountAmount: true },
  });
  if (items.length === 0) return NextResponse.json<ApiResponse>({ success: false, error: "Ninguno de los productos elegidos admite descuento" }, { status: 400 });

  const ops = [];
  for (const it of items) {
    const lineTotal = round2(Number(it.lineTotal));
    const currentDiscount = round2(Number(it.discountAmount));
    const room = round2(lineTotal - currentDiscount);
    if (room <= 0) continue; // renglón sin saldo: se salta
    const amount = round2(Math.min(computeDiscountAmount(lineTotal, type, value), room));
    if (amount <= 0) continue;
    ops.push(prisma.comandaDiscount.create({
      data: { tenantId: TENANT, comandaId: id, scope: "ITEM", itemId: it.id, type, value, amount, reason, authorizedById },
    }));
    ops.push(prisma.comandaItem.update({ where: { id: it.id }, data: { discountAmount: round2(currentDiscount + amount) } }));
  }
  if (ops.length === 0) return NextResponse.json<ApiResponse>({ success: false, error: "El descuento resulta en $0 en todos los productos elegidos" }, { status: 400 });

  await prisma.$transaction(ops);
  await recalcComandaTotals(id);

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
