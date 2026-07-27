import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES } from "@/lib/comanda";
import { round2 } from "@/lib/comandaTotals";
import { buildCut, CASH_SESSION_INCLUDE } from "@/lib/caja";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/caja/sessions/:id/close — cierra el turno (corte Z). requireCashier.
 * Body: { countedCash: number, notes? }
 * - Bloquea (409) si quedan comandas activas sin cobrar → no se cierra el cajón
 *   con dinero pendiente en el piso (cierra el hueco de cuentas huérfanas).
 * - Congela cutSnapshot (breakdown por método) inmutable; calcula expectedCash
 *   (fondo + efectivo) y difference (arqueo − esperado, sobra/falta).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const countedCash = Number(body?.countedCash);
  if (!Number.isFinite(countedCash) || countedCash < 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Arqueo de efectivo inválido" }, { status: 400 });
  }
  const notes = typeof body?.notes === "string" ? body.notes : null;

  const session = await prisma.cashSession.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, status: true },
  });
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Turno no encontrado" }, { status: 404 });
  if (session.status !== "OPEN") {
    return NextResponse.json<ApiResponse>({ success: false, error: "El turno ya está cerrado" }, { status: 409 });
  }

  // No cerrar con cuentas activas (dinero pendiente en el piso).
  const pending = await prisma.comanda.findMany({
    where: { tenantId: TENANT, status: { in: [...ACTIVE_STATUSES] } },
    select: { folio: true },
    take: 20,
  });
  if (pending.length > 0) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: `Hay ${pending.length} cuenta(s) sin cerrar: ${pending.map((c) => c.folio).join(", ")}. Cóbralas o ciérralas antes del corte.`,
      },
      { status: 409 },
    );
  }

  const cut = await buildCut(id);
  const difference = round2(countedCash - cut.expectedCash);

  const updated = await prisma.cashSession.update({
    where: { id },
    data: {
      status: "CLOSED",
      closedById: a.staffId,
      closedAt: new Date(),
      countedCash,
      expectedCash: cut.expectedCash,
      difference,
      cutSnapshot: cut as unknown as Prisma.InputJsonValue,
      ...(notes ? { notes } : {}),
    },
    include: CASH_SESSION_INCLUDE,
  });

  return NextResponse.json<ApiResponse>({ success: true, data: { session: updated, cut, difference } });
}
