import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireComandaSupervisor } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE } from "@/lib/comanda";
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
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: no se puede cancelar` }, { status: 409 });
  }

  await prisma.comanda.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: s.staffId, cancellationReason },
  });

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
