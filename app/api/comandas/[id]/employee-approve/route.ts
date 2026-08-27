import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/dualAuth";
import { verifyWaiterPin } from "@/lib/staff";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/employee-approve — #4 El empleado APRUEBA (palomea) que la cuenta
 * ligada se le cargue a crédito. Body: { pin }. Se valida el PIN del empleado ligado, así
 * funciona tanto desde su propia pantalla (Cartera) como tecleado en la terminal de caja.
 * Deja la cuenta APPROVED; recién entonces caja puede cobrarla a crédito.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const pin = typeof body?.pin === "string" ? body.pin : "";

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, status: true, chargedEmployeeId: true, employeeChargeStatus: true },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (comanda.chargedEmployeeId == null) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Esta cuenta no está ligada a ningún empleado" }, { status: 409 });
  }
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: ya no se puede aprobar` }, { status: 409 });
  }

  const okPin = await verifyWaiterPin(comanda.chargedEmployeeId, pin);
  if (!okPin) return NextResponse.json<ApiResponse>({ success: false, error: "PIN del empleado inválido" }, { status: 403 });

  await prisma.comanda.update({
    where: { id },
    data: { employeeChargeStatus: "APPROVED", employeeChargeApprovedAt: new Date() },
  });

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
