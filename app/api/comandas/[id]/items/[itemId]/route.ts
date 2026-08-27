import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActor, isSupervisor } from "@/lib/dualAuth";
import { verifySupervisorPin } from "@/lib/staff";
import { prepAreaToTarget } from "@/lib/comandaRules";
import { TENANT, COMANDA_INCLUDE, recalcComandaTotals, isEditableStatus, LOCKED_ACCOUNT_MSG } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * DELETE /api/comandas/:id/items/:itemId — cancela (soft) un item.
 * - status PENDING: WAITER dueño, o supervisor (CAPTAIN/MANAGER/ADMIN).
 * - status SENT o posterior: SOLO supervisor (CAPTAIN/MANAGER/ADMIN), con body.reason obligatorio.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const id = parseId(params.id);
  const itemId = parseId(params.itemId);
  if (!id || !itemId) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const item = await prisma.comandaItem.findFirst({
    where: { id: itemId, comandaId: id, tenantId: TENANT },
    include: {
      dish: { select: { category: { select: { name: true, carta: { select: { name: true } } } } } },
      comanda: { select: {
        waiterId: true, openedById: true, tableId: true, status: true,
        folio: true, customName: true,
        waiter: { select: { fullName: true } },
        table: { select: { number: true, section: { select: { name: true } } } },
      } },
    },
  });
  if (!item) return NextResponse.json<ApiResponse>({ success: false, error: "Item no encontrado" }, { status: 404 });
  if (item.status === "CANCELLED") {
    return NextResponse.json<ApiResponse>({ success: false, error: "El item ya está cancelado" }, { status: 409 });
  }
  // Regla: no se cancela un producto de una cuenta impresa / por cobrar sin reabrirla primero.
  if (!isEditableStatus(item.comanda.status)) {
    return NextResponse.json<ApiResponse>({ success: false, error: LOCKED_ACCOUNT_MSG }, { status: 409 });
  }

  const supervisor = isSupervisor(actor);
  const isOwnerWaiter = actor.realm === "staff" && actor.role === "WAITER" && item.comanda.waiterId === actor.staffId;
  // Para llevar (sin mesa): la maneja caja; quitar productos AÚN sin enviar lo puede hacer
  // cualquier rol de caja (su mesero es el de sistema "Llevar"). También quien la abrió.
  const isTakeoutCaja = item.comanda.tableId === null && actor.realm === "staff" &&
    (actor.role === "OPERATION" || actor.role === "CAPTAIN" || actor.role === "MANAGER");
  const isOpener = actor.realm === "staff" && item.comanda.openedById === actor.staffId;
  const allowed = item.status === "PENDING" ? (supervisor || isOwnerWaiter || isOpener || isTakeoutCaja) : supervisor;
  if (!allowed) {
    const sentMsg = "Item ya enviado a cocina: solo Capitán/Manager/Admin puede cancelarlo";
    return NextResponse.json<ApiResponse>(
      { success: false, error: item.status === "PENDING" ? "No autorizado" : sentMsg },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const reason: string | undefined = typeof body?.reason === "string" ? body.reason.trim() : undefined;

  // Cancelar un producto YA enviado exige motivo + PIN de supervisor (Capitán/Manager).
  // Quien queda como responsable en la auditoría es el DUEÑO del PIN, no la sesión.
  let cancelledById = actor.staffId;
  if (item.status !== "PENDING") {
    if (!reason) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Motivo (reason) obligatorio para cancelar un producto enviado" }, { status: 400 });
    }
    const authPin = typeof body?.authPin === "string" ? body.authPin : "";
    const authorizedById = await verifySupervisorPin(authPin, { tenantId: TENANT });
    if (!authorizedById) {
      return NextResponse.json<ApiResponse>({ success: false, error: "PIN de supervisor inválido (Capitán/Manager)" }, { status: 403 });
    }
    cancelledById = authorizedById;
  }

  await prisma.comandaItem.update({
    where: { id: itemId },
    data: {
      status: "CANCELLED",
      cancelledById,
      cancelledReason: reason ?? null,
      cancelledAt: new Date(),
    },
  });

  // Producto YA enviado a cocina/barra: al cancelarlo se avisa con un ticket de CANCELACIÓN
  // a la misma área en el acto (los PENDING nunca llegaron a cocina, no requieren aviso).
  // cancelledById aquí es el supervisor autorizante (nunca null en la rama SENT).
  if (item.status !== "PENDING" && cancelledById != null) {
    const authName = (await prisma.staff.findUnique({ where: { id: cancelledById }, select: { fullName: true } }))?.fullName ?? null;
    const tableLabel = item.comanda.table
      ? `Mesa ${item.comanda.table.number} - ${item.comanda.table.section.name}`
      : (item.comanda.customName || "Cuenta sin mesa");
    await prisma.comandaPrint.create({
      data: {
        tenantId: TENANT,
        comandaId: id,
        type: "KITCHEN_CANCEL",
        target: prepAreaToTarget(item.prepAreaSnapshot),
        executedById: cancelledById,
        status: "PENDING",
        payload: {
          kind: "cancel",
          folio: item.comanda.folio,
          table: tableLabel,
          waiter: item.comanda.waiter.fullName,
          area: item.prepAreaSnapshot,
          time: new Date().toISOString(),
          item: { qty: Number(item.quantity), name: item.dishNameSnapshot, origin: item.dish?.category ? (item.dish.category.carta ? `${item.dish.category.carta.name} · ${item.dish.category.name}` : item.dish.category.name) : null },
          reason: reason ?? null,
          authorizedBy: authName,
        },
      },
    });
  }

  await recalcComandaTotals(id);
  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
