import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireComandaSupervisor } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE } from "@/lib/comanda";
import { notify } from "@/lib/notify";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/change-waiter — reasigna el mesero. SOLO CAPTAIN/MANAGER.
 * Preserva todos los items. Registra ComandaWaiterChange. Atómico.
 * Body: { toWaiterId, reason? }
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireComandaSupervisor(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Capitán/Manager/Admin" }, { status: 403 });
  if (s.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario admin no está vinculado a un empleado (Staff)" }, { status: 409 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const toWaiterId: number | undefined = Number.isInteger(body?.toWaiterId) ? body.toWaiterId : undefined;
  const reason: string | null = typeof body?.reason === "string" ? body.reason : null;
  if (!toWaiterId) return NextResponse.json<ApiResponse>({ success: false, error: "toWaiterId es obligatorio" }, { status: 400 });

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, waiterId: true, status: true },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: no se puede reasignar` }, { status: 409 });
  }
  if (comanda.waiterId === toWaiterId) {
    return NextResponse.json<ApiResponse>({ success: false, error: "La comanda ya tiene ese mesero" }, { status: 409 });
  }

  const newWaiter = await prisma.staff.findFirst({
    where: { id: toWaiterId, tenantId: TENANT, active: true },
    select: { id: true },
  });
  if (!newWaiter) return NextResponse.json<ApiResponse>({ success: false, error: "Mesero destino no encontrado o inactivo" }, { status: 404 });

  await prisma.$transaction([
    prisma.comandaWaiterChange.create({
      data: { tenantId: TENANT, comandaId: id, fromWaiterId: comanda.waiterId, toWaiterId, changedById: s.staffId, reason },
    }),
    prisma.comanda.update({ where: { id }, data: { waiterId: toWaiterId } }),
  ]);

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  void notify({ roles: ["MANAGER"], type: "audit", title: "Cambio de mesero", body: `${updated?.folio ?? `#${id}`}${updated?.waiter ? ` · ahora ${updated.waiter.fullName}` : ""}`, url: "/admin/comandas" });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
