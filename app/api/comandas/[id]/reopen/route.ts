import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { verifySupervisorPin } from "@/lib/staff";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE, statusAfterReopen } from "@/lib/comanda";
import { notify } from "@/lib/notify";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/reopen — reabre una cuenta ya cobrada (PAID → AWAITING_PAYMENT).
 * requireCashier + authPin de Capitán/Manager. Body: { authPin, reason, voidPayments? }
 * - voidPayments=true: anula los pagos (los revierte del corte) y deja saldo en 0.
 *   false: conserva los pagos (corrección menor sin tocar dinero).
 * - GUARD: no reabre si la mesa ya tiene otra cuenta activa (evita 2 cuentas vivas
 *   en la misma mesa). Registra ComandaReopen y reopenCount++.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const authPin = typeof body?.authPin === "string" ? body.authPin : "";
  const voidPayments = body?.voidPayments === true;
  if (!reason) return NextResponse.json<ApiResponse>({ success: false, error: "El motivo es obligatorio" }, { status: 400 });

  // Reabrir una cuenta ya cobrada solo lo autoriza un ADMINISTRADOR (Manager). Perla
  // (Operación) y el Capitán NO pueden reabrir: la cuenta pagada queda sellada para ellos.
  const authorizedById = await verifySupervisorPin(authPin, { tenantId: TENANT, roles: ["MANAGER"] });
  if (!authorizedById) {
    return NextResponse.json<ApiResponse>({ success: false, error: "PIN de administrador (Manager) inválido" }, { status: 403 });
  }

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, status: true, tableId: true },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (comanda.status !== "PAID") {
    return NextResponse.json<ApiResponse>({ success: false, error: `Solo se reabren cuentas PAID (esta está ${comanda.status})` }, { status: 409 });
  }

  // La mesa no puede terminar con dos cuentas activas (solo aplica si tiene mesa).
  const busy = comanda.tableId
    ? await prisma.comanda.findFirst({
        where: { tenantId: TENANT, tableId: comanda.tableId, status: { in: [...ACTIVE_STATUSES] }, id: { not: id } },
        select: { folio: true },
      })
    : null;
  if (busy) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: `La mesa ya tiene otra cuenta activa (${busy.folio}); no se puede reabrir aquí` },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    if (voidPayments) {
      await tx.comandaPayment.updateMany({
        where: { comandaId: id, tenantId: TENANT, voided: false },
        data: { voided: true, voidedById: a.staffId, voidedReason: reason, voidedAt: new Date() },
      });
    }
    // Con los pagos anulados la cuenta vuelve a estar realmente sin cobrar, así
    // que regresa a IN_SERVICE: el mesero recupera todas las acciones de mesa
    // en servicio (agregar, cancelar, mover, descontar). Antes quedaba siempre
    // en AWAITING_PAYMENT —que no está en EDITABLE_STATUSES— y reabrir dejaba
    // la cuenta igual de bloqueada que antes: sólo cobrar o volver a reabrir.
    //
    // Si los pagos se conservan, el dinero sigue sobre la cuenta y editar los
    // productos podría dejar el total por debajo de lo ya cobrado. Ese caso
    // permanece en AWAITING_PAYMENT; para editarlo está /unlock, con su propia
    // autorización y motivo.
    await tx.comanda.update({
      where: { id },
      data: {
        status: statusAfterReopen(voidPayments),
        awaitingPaymentAt: voidPayments ? null : new Date(),
        closedAt: null,
        closedById: null,
        reopenCount: { increment: 1 },
        ...(voidPayments ? { amountPaid: 0, tipTotal: 0, cashSessionId: null } : {}),
      },
    });
    await tx.comandaReopen.create({
      data: {
        tenantId: TENANT,
        comandaId: id,
        previousStatus: "PAID",
        voidedPayments: voidPayments,
        reason,
        reopenedById: authorizedById,
      },
    });
  });

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  void notify({ roles: ["MANAGER"], type: "audit", title: "Cuenta reabierta (pagada)", body: `${updated?.folio ?? `#${id}`} · ${reason}${voidPayments ? " · pagos anulados" : ""}`, url: "/admin/comandas" });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
