import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/caja/sessions/:id/reprint-corte — reimprime el ticket de CORTE (Z-report) de un
 * turno ya cerrado, incluso de un día pasado (histórico). Clona el payload del corte original
 * (lo busca por folio de caja) y lo reencola a la impresora de CAJA. requireCashier.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja (Operación/Capitán/Manager)" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const session = await prisma.cashSession.findFirst({ where: { id, tenantId: TENANT }, select: { id: true, folio: true, status: true } });
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Corte no encontrado" }, { status: 404 });

  // Busca el ticket de corte ORIGINAL de esta caja por folio y clona su payload.
  const original = await prisma.comandaPrint.findFirst({
    where: { tenantId: TENANT, type: "CORTE", payload: { path: ["folio"], equals: session.folio } },
    orderBy: { printedAt: "desc" },
    select: { payload: true },
  });
  if (!original?.payload || typeof original.payload !== "object") {
    return NextResponse.json<ApiResponse>({ success: false, error: "No hay corte original para reimprimir (¿el turno ya cerró?)" }, { status: 400 });
  }

  const payload = { ...(original.payload as Record<string, unknown>), reprint: true };
  await prisma.comandaPrint.create({
    data: {
      tenantId: TENANT, comandaId: null, type: "CORTE", target: "CAJA",
      executedById: a.staffId as number, status: "PENDING",
      payload: payload as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json<ApiResponse>({ success: true, data: { id: session.id } });
}
