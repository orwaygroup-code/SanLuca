import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE, recalcComandaTotals } from "@/lib/comanda";
import { round2 } from "@/lib/comandaTotals";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/extra — Caja agrega un "extra" / especial: un cargo con
 * nombre y precio puestos en el momento (paquete, especial del chef, precio
 * especial) que NO existe en el menú. Cuenta al total y sale en la cuenta/ticket
 * como lo que caja escriba. No va a cocina (nace DELIVERED). requireCashier.
 * Body: { name: string, price: number, quantity?: number }
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja (Operación/Capitán/Manager)" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  const price = round2(Number(body?.price));
  const rawQty = typeof body?.quantity === "number" && Number.isFinite(body.quantity) && body.quantity > 0 ? body.quantity : 1;
  const qty = Math.min(999, Math.round(rawQty * 100) / 100);
  if (!name) return NextResponse.json<ApiResponse>({ success: false, error: "Ponle un nombre al extra" }, { status: 400 });
  if (!Number.isFinite(price) || price <= 0) return NextResponse.json<ApiResponse>({ success: false, error: "Precio del extra inválido" }, { status: 400 });

  const comanda = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, select: { id: true, status: true } });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: no se pueden agregar extras` }, { status: 409 });
  }

  await prisma.comandaItem.create({
    data: {
      tenantId: TENANT,
      comandaId: id,
      dishId: null,
      isExtra: true,
      dishNameSnapshot: name,
      unitPriceSnapshot: price,
      prepAreaSnapshot: "COCINA", // no se manda a cocina (nace DELIVERED); solo cuenta al total
      quantity: qty,
      course: 1,
      modifiersExtraCost: 0,
      lineTotal: round2(price * qty),
      status: "DELIVERED", // es un cargo ya "entregado", no un pendiente de cocina/barra
      addedById: a.staffId,
    },
  });

  await recalcComandaTotals(id);
  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated }, { status: 201 });
}
