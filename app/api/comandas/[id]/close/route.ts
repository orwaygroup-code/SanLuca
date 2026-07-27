import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE, settleComanda, completeLinkedReservation } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/close — marca la comanda PAID. SOLO OPERATION/CAPTAIN.
 * Libera la mesa (status terminal) y, si hay reserva ligada, la marca COMPLETED.
 * NO cobra dentro del sistema (la caja cobra fuera).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireStaffRole(request, ["OPERATION", "CAPTAIN"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Operación/Capitán" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, status: true, reservationId: true },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: no se puede cerrar` }, { status: 409 });
  }

  await settleComanda(prisma, id, s.staffId);
  await completeLinkedReservation(id);

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
