import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/change-table — mueve la comanda a otra mesa. SOLO CAPTAIN/MANAGER.
 * Preserva todos los items. Registra ComandaTableChange. Atómico.
 * Body: { toTableId, reason? }
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireStaffRole(request, ["CAPTAIN", "MANAGER"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Capitán/Manager" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const toTableId: string | undefined = typeof body?.toTableId === "string" ? body.toTableId : undefined;
  const reason: string | null = typeof body?.reason === "string" ? body.reason : null;
  if (!toTableId) return NextResponse.json<ApiResponse>({ success: false, error: "toTableId es obligatorio" }, { status: 400 });

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, tableId: true, status: true },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: no se puede mover` }, { status: 409 });
  }
  if (comanda.tableId === toTableId) {
    return NextResponse.json<ApiResponse>({ success: false, error: "La comanda ya está en esa mesa" }, { status: 409 });
  }

  const table = await prisma.table.findFirst({ where: { id: toTableId }, select: { id: true } });
  if (!table) return NextResponse.json<ApiResponse>({ success: false, error: "Mesa destino no encontrada" }, { status: 404 });

  const busy = await prisma.comanda.findFirst({
    where: { tenantId: TENANT, tableId: toTableId, status: { in: [...ACTIVE_STATUSES] }, id: { not: id } },
    select: { folio: true },
  });
  if (busy) return NextResponse.json<ApiResponse>({ success: false, error: `Mesa destino ocupada (${busy.folio})` }, { status: 409 });

  await prisma.$transaction([
    prisma.comandaTableChange.create({
      data: { tenantId: TENANT, comandaId: id, fromTableId: comanda.tableId, toTableId, changedById: s.staffId, reason },
    }),
    prisma.comanda.update({ where: { id }, data: { tableId: toTableId } }),
  ]);

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
