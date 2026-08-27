import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireComandaSupervisor } from "@/lib/dualAuth";
import { TENANT, COMANDA_INCLUDE, isEditableStatus, LOCKED_ACCOUNT_MSG } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/cancel — cancela la comanda completa. SOLO CAPTAIN/MANAGER.
 * Body: { cancellationReason } (obligatorio).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireComandaSupervisor(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Capitán/Manager/Admin" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const cancellationReason: string | undefined =
    typeof body?.cancellationReason === "string" && body.cancellationReason.trim()
      ? body.cancellationReason.trim()
      : undefined;
  if (!cancellationReason) {
    return NextResponse.json<ApiResponse>({ success: false, error: "cancellationReason es obligatorio" }, { status: 400 });
  }

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, status: true },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  // Regla: una cuenta impresa / por cobrar NO se cancela sin reabrirla primero.
  if (!isEditableStatus(comanda.status)) {
    const locked = comanda.status === "AWAITING_PAYMENT" || comanda.status === "PARTIALLY_PAID";
    return NextResponse.json<ApiResponse>({ success: false, error: locked ? LOCKED_ACCOUNT_MSG : `Comanda ${comanda.status}: no se puede cancelar` }, { status: 409 });
  }

  await prisma.comanda.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: s.staffId, cancellationReason },
  });

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
