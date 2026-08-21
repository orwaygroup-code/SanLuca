import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActor, isSupervisor } from "@/lib/dualAuth";
import { verifySupervisorPin } from "@/lib/staff";
import { prepAreaToTarget } from "@/lib/comandaRules";
import { TENANT, COMANDA_INCLUDE, recalcComandaTotals } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/items/batch-cancel { itemIds:number[], reason?, authPin? }
 * Cancela VARIOS productos de un jale. Si alguno ya está enviado (no PENDING) exige motivo
 * + UN solo PIN de supervisor para todo el lote, e imprime un aviso de CANCELACIÓN por cada
 * producto enviado. Los PENDING los puede cancelar el dueño/opener/caja/supervisor.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const itemIds: number[] = Array.isArray(body?.itemIds) ? body.itemIds.filter((n: unknown) => Number.isInteger(n)) : [];
  if (itemIds.length === 0) return NextResponse.json<ApiResponse>({ success: false, error: "Elige al menos un producto" }, { status: 400 });
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const authPin = typeof body?.authPin === "string" ? body.authPin : "";

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: {
      id: true, status: true, waiterId: true, openedById: true, tableId: true, folio: true, customName: true,
      waiter: { select: { fullName: true } },
      table: { select: { number: true, section: { select: { name: true } } } },
    },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });

  const items = await prisma.comandaItem.findMany({
    where: { id: { in: itemIds }, comandaId: id, tenantId: TENANT, status: { not: "CANCELLED" } },
    select: { id: true, status: true, dishNameSnapshot: true, quantity: true, prepAreaSnapshot: true, dish: { select: { category: { select: { name: true, carta: { select: { name: true } } } } } } },
  });
  if (items.length === 0) return NextResponse.json<ApiResponse>({ success: false, error: "Ninguno de los productos elegidos se puede cancelar" }, { status: 400 });

  const sentItems = items.filter((i) => i.status !== "PENDING");

  const isStaff = actor.realm === "staff";
  let authorizerId: number | null = isStaff ? actor.staffId : null;
  if (sentItems.length > 0) {
    if (!reason) return NextResponse.json<ApiResponse>({ success: false, error: "Motivo obligatorio para cancelar productos ya enviados" }, { status: 400 });
    const authorizedById = await verifySupervisorPin(authPin, { tenantId: TENANT });
    if (!authorizedById) return NextResponse.json<ApiResponse>({ success: false, error: "PIN de supervisor inválido (Capitán/Manager)" }, { status: 403 });
    authorizerId = authorizedById;
  } else {
    // Solo PENDING: dueño / opener / caja-en-llevar / supervisor.
    const isOwnerWaiter = isStaff && actor.role === "WAITER" && comanda.waiterId === actor.staffId;
    const isOpener = isStaff && comanda.openedById === actor.staffId;
    const isTakeoutCaja = comanda.tableId === null && isStaff && (actor.role === "OPERATION" || actor.role === "CAPTAIN" || actor.role === "MANAGER");
    if (!(isSupervisor(actor) || isOwnerWaiter || isOpener || isTakeoutCaja)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });
    }
  }

  await prisma.comandaItem.updateMany({
    where: { id: { in: items.map((i) => i.id) }, comandaId: id, tenantId: TENANT },
    data: { status: "CANCELLED", cancelledById: authorizerId, cancelledReason: reason || null, cancelledAt: new Date() },
  });

  // Aviso de CANCELACIÓN a cocina/barra por cada producto que YA estaba enviado.
  if (sentItems.length > 0 && authorizerId != null) {
    const authName = (await prisma.staff.findUnique({ where: { id: authorizerId }, select: { fullName: true } }))?.fullName ?? null;
    const tableLabel = comanda.table ? `Mesa ${comanda.table.number} - ${comanda.table.section.name}` : (comanda.customName || "Cuenta sin mesa");
    const now = new Date().toISOString();
    await prisma.$transaction(sentItems.map((it) => prisma.comandaPrint.create({
      data: {
        tenantId: TENANT, comandaId: id, type: "KITCHEN_CANCEL", target: prepAreaToTarget(it.prepAreaSnapshot),
        executedById: authorizerId as number, status: "PENDING",
        payload: {
          kind: "cancel", folio: comanda.folio, table: tableLabel, waiter: comanda.waiter.fullName,
          area: it.prepAreaSnapshot, time: now, item: { qty: Number(it.quantity), name: it.dishNameSnapshot, origin: it.dish?.category ? (it.dish.category.carta ? `${it.dish.category.carta.name} · ${it.dish.category.name}` : it.dish.category.name) : null },
          reason: reason || null, authorizedBy: authName,
        },
      },
    })));
  }

  await recalcComandaTotals(id);
  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
