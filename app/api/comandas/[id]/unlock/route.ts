import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { verifySupervisorPin } from "@/lib/staff";
import { TENANT, COMANDA_INCLUDE } from "@/lib/comanda";
import { notify } from "@/lib/notify";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/unlock — reabre una cuenta "por cobrar" (AWAITING_PAYMENT /
 * PARTIALLY_PAID) para volver a MODIFICARLA: la regresa a IN_SERVICE. requireCashier +
 * PIN de supervisor (Capitán/Manager) + motivo. Registra ComandaReopen para auditoría.
 * Los pagos parciales se CONSERVAN (el saldo se recalcula sobre el nuevo total). Distinto
 * de /reopen, que reabre una cuenta ya PAGADA (y lo autoriza solo un Manager).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja (Operación/Capitán/Manager)" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const authPin = typeof body?.authPin === "string" ? body.authPin : "";
  if (!reason) return NextResponse.json<ApiResponse>({ success: false, error: "El motivo es obligatorio" }, { status: 400 });

  const authorizedById = await verifySupervisorPin(authPin, { tenantId: TENANT });
  if (!authorizedById) return NextResponse.json<ApiResponse>({ success: false, error: "PIN de supervisor inválido (Capitán/Manager)" }, { status: 403 });

  const comanda = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, select: { id: true, status: true } });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (comanda.status !== "AWAITING_PAYMENT" && comanda.status !== "PARTIALLY_PAID") {
    return NextResponse.json<ApiResponse>({ success: false, error: `Solo se reabren cuentas por cobrar (esta está ${comanda.status})` }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.comanda.update({ where: { id }, data: { status: "IN_SERVICE", reopenCount: { increment: 1 } } });
    await tx.comandaReopen.create({
      data: { tenantId: TENANT, comandaId: id, previousStatus: comanda.status, voidedPayments: false, reason, reopenedById: authorizedById },
    });
  });

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  void notify({ roles: ["MANAGER"], type: "audit", title: "Cuenta reabierta (por cobrar)", body: `${updated?.folio ?? `#${id}`} · ${reason}`, url: "/admin/comandas" });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
