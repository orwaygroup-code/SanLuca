import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES, enqueueDrawerKick } from "@/lib/comanda";
import { round2 } from "@/lib/comandaTotals";
import { buildCut, CASH_SESSION_INCLUDE } from "@/lib/caja";
import { loadWaiterBase } from "@/lib/tips";
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

  // No cerrar sin liquidar la propina (7%) de cada mesero con ventas del turno.
  // Se bloquea si falta liquidar a alguien, o si un mesero ya liquidado siguió
  // vendiendo después (su venta actual supera la que se liquidó → 7% incompleto).
  const waiterBase = await loadWaiterBase(id);
  if (waiterBase.length > 0) {
    const settled = await prisma.waiterTipSettlement.findMany({
      where: { cashSessionId: id },
      select: { waiterId: true, salesTotal: true },
    });
    const settledMap = new Map(settled.map((s) => [s.waiterId, Number(s.salesTotal)]));
    const missing = waiterBase.filter((w) => !settledMap.has(w.waiterId));
    if (missing.length > 0) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `Falta liquidar la propina de ${missing.length} mesero(s): ${missing.map((w) => w.fullName).join(", ")}. Ve a la pestaña «Propinas» y liquídalos antes del corte.`,
        },
        { status: 409 },
      );
    }
    const stale = waiterBase.filter((w) => w.salesTotal > (settledMap.get(w.waiterId) ?? 0) + 0.005);
    if (stale.length > 0) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `${stale.length} mesero(s) vendieron más después de liquidar (${stale.map((w) => w.fullName).join(", ")}). Vuelve a liquidarlos antes del corte.`,
        },
        { status: 409 },
      );
    }
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

  // Corte de caja: abre el cajón para contar el efectivo (sin comanda). Fire-and-forget.
  await enqueueDrawerKick({ staffId: a.staffId as number, comandaId: null });

  return NextResponse.json<ApiResponse>({ success: true, data: { session: updated, cut, difference } });
}
