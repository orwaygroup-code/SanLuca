import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireCashier } from "@/lib/dualAuth";
import { verifySupervisorPin } from "@/lib/staff";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE, recalcComandaTotals } from "@/lib/comanda";
import { round2 } from "@/lib/comandaTotals";
import { splitBillDiscount } from "@/lib/comandaRules";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/transfer-items { toComandaId, itemIds:number[], authPin, reason? }
 * Traspasa VARIOS productos COMPLETOS de la cuenta :id a otra. requireCashier + un solo PIN
 * de supervisor para todo el lote. (Traspaso total del renglón; el parcial se hace 1×1 con
 * /transfer-item.)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const fromId = parseId(params.id);
  if (!fromId) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const toId = parseId(String(body?.toComandaId));
  const itemIds: number[] = Array.isArray(body?.itemIds) ? body.itemIds.filter((n: unknown) => Number.isInteger(n)) : [];
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;
  const authPin = typeof body?.authPin === "string" ? body.authPin : "";
  if (!toId || itemIds.length === 0) return NextResponse.json<ApiResponse>({ success: false, error: "toComandaId e itemIds son obligatorios" }, { status: 400 });
  if (toId === fromId) return NextResponse.json<ApiResponse>({ success: false, error: "El destino debe ser otra cuenta" }, { status: 400 });

  const authorizedById = await verifySupervisorPin(authPin, { tenantId: TENANT });
  if (!authorizedById) return NextResponse.json<ApiResponse>({ success: false, error: "PIN de supervisor inválido (Capitán/Manager)" }, { status: 403 });

  const [from, to] = await Promise.all([
    prisma.comanda.findFirst({ where: { id: fromId, tenantId: TENANT }, select: { id: true, status: true, discountTotal: true } }),
    prisma.comanda.findFirst({ where: { id: toId, tenantId: TENANT }, select: { id: true, status: true } }),
  ]);
  if (!from) return NextResponse.json<ApiResponse>({ success: false, error: "Cuenta origen no encontrada" }, { status: 404 });
  if (!to) return NextResponse.json<ApiResponse>({ success: false, error: "Cuenta destino no encontrada" }, { status: 404 });
  for (const [c, label] of [[from, "origen"], [to, "destino"]] as const) {
    if (!ACTIVE_STATUSES.includes(c.status as (typeof ACTIVE_STATUSES)[number])) {
      return NextResponse.json<ApiResponse>({ success: false, error: `Cuenta ${label} ${c.status}: no admite traspaso` }, { status: 409 });
    }
  }

  const items = await prisma.comandaItem.findMany({
    where: { id: { in: itemIds }, comandaId: fromId, tenantId: TENANT, status: { not: "CANCELLED" } },
    select: { id: true, dishNameSnapshot: true, quantity: true, lineTotal: true, discountAmount: true },
  });
  if (items.length === 0) return NextResponse.json<ApiResponse>({ success: false, error: "Ninguno de los productos elegidos se puede traspasar" }, { status: 400 });

  // Tipado explícito: al arreglo se le suman después actualizaciones de Comanda,
  // y la inferencia lo dejaría atado solo a operaciones de ComandaItem.
  const ops: Prisma.PrismaPromise<unknown>[] = items.flatMap((it) => [
    prisma.comandaItem.update({ where: { id: it.id }, data: { comandaId: toId } }),
    prisma.comandaItemTransfer.create({
      data: {
        tenantId: TENANT, fromComandaId: fromId, toComandaId: toId,
        dishNameSnapshot: it.dishNameSnapshot, quantity: it.quantity, lineTotalSnapshot: it.lineTotal,
        movedById: authorizedById, reason,
      },
    }),
  ]);

  // El descuento A NIVEL CUENTA sigue a los productos en proporción a lo que se
  // llevan: se pactó sobre el consumo entero, así que si la mitad se va a otra
  // cuenta, la mitad de la rebaja se va con ella. Quedándose entero en el
  // origen, un traspaso grande lo acotaba en cero y el cliente pagaba de más.
  const grossOf = (lineTotal: unknown, itemDiscount: unknown) => Math.max(0, round2(Number(lineTotal) - Number(itemDiscount)));
  const todos = await prisma.comandaItem.findMany({
    where: { comandaId: fromId, tenantId: TENANT, status: { not: "CANCELLED" } },
    select: { lineTotal: true, discountAmount: true },
  });
  const totalGross = todos.reduce((s, i) => s + grossOf(i.lineTotal, i.discountAmount), 0);
  const movedGross = items.reduce((s, i) => s + grossOf(i.lineTotal, i.discountAmount), 0);
  const reparto = splitBillDiscount({ discountTotal: Number(from.discountTotal), movedGross, totalGross });
  if (reparto.moved > 0) {
    ops.push(
      prisma.comanda.update({ where: { id: fromId }, data: { discountTotal: reparto.remaining } }),
      prisma.comanda.update({ where: { id: toId }, data: { discountTotal: { increment: reparto.moved } } }),
    );
  }

  await prisma.$transaction(ops);
  await Promise.all([recalcComandaTotals(fromId), recalcComandaTotals(toId)]);

  const [fromUpd, toUpd] = await Promise.all([
    prisma.comanda.findFirst({ where: { id: fromId, tenantId: TENANT }, include: COMANDA_INCLUDE }),
    prisma.comanda.findFirst({ where: { id: toId, tenantId: TENANT }, include: COMANDA_INCLUDE }),
  ]);
  return NextResponse.json<ApiResponse>({ success: true, data: { from: fromUpd, to: toUpd } });
}
