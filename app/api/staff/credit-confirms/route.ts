import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

/**
 * GET /api/staff/credit-confirms — confirmaciones de "crédito de personal" PENDIENTES para el
 * empleado logueado (las que caja le mandó a su tablet). Él las confirma con su PIN.
 */
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });
  if (actor.staffId == null) return NextResponse.json<ApiResponse>({ success: true, data: [] });

  const rows = await prisma.staffCreditConfirm.findMany({
    where: { tenantId: TENANT, employeeId: actor.staffId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, amount: true, createdAt: true, comandaId: true },
  });
  if (rows.length === 0) return NextResponse.json<ApiResponse>({ success: true, data: [] });

  // Etiqueta de cada cuenta (mesa o nombre) para mostrarla en la tablet.
  const comandas = await prisma.comanda.findMany({
    where: { id: { in: rows.map((r) => r.comandaId) }, tenantId: TENANT },
    select: { id: true, folio: true, customName: true, table: { select: { number: true } } },
  });
  const label = new Map(comandas.map((c) => [c.id, c.table ? `Mesa ${c.table.number}` : (c.customName || c.folio)]));

  return NextResponse.json<ApiResponse>({
    success: true,
    data: rows.map((r) => ({ id: r.id, amount: Number(r.amount), createdAt: r.createdAt.toISOString(), label: label.get(r.comandaId) ?? `#${r.comandaId}` })),
  });
}
