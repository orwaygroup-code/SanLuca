import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT, isUniqueViolation } from "@/lib/comanda";
import { getShiftWindow } from "@/lib/shifts";
import { getOpenSession, nextCashFolio, CASH_SESSION_INCLUDE } from "@/lib/caja";
import type { ApiResponse } from "@/types";

/**
 * POST /api/caja/sessions — abre un turno de caja (cajón). requireCashier.
 * Body: { openingFloat: number, notes?, registerId? }
 * Regla "1 sesión OPEN por tenant": 409 si ya hay una abierta (como "1 comanda
 * activa por mesa"). Cierra el hueco de dos cajones abiertos en paralelo.
 */
export async function POST(request: NextRequest) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja (Operación/Capitán/Manager)" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const openingFloat = Number(body?.openingFloat);
  if (!Number.isFinite(openingFloat) || openingFloat < 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Fondo inicial inválido" }, { status: 400 });
  }
  const notes = typeof body?.notes === "string" ? body.notes : null;
  const registerId = typeof body?.registerId === "string" ? body.registerId : null;

  const open = await getOpenSession();
  if (open) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: `Ya hay un turno abierto (${open.folio}). Ciérralo antes de abrir otro.` },
      { status: 409 },
    );
  }

  const shift = getShiftWindow(new Date()).name;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const created = await prisma.cashSession.create({
        data: {
          tenantId: TENANT,
          folio: await nextCashFolio(),
          registerId,
          shift,
          openingFloat,
          openedById: a.staffId,
          notes,
        },
        include: CASH_SESSION_INCLUDE,
      });
      return NextResponse.json<ApiResponse>({ success: true, data: created }, { status: 201 });
    } catch (e) {
      if (isUniqueViolation(e)) continue; // colisión de folio → reintentar
      console.error("[Caja] POST /sessions error:", e);
      return NextResponse.json<ApiResponse>({ success: false, error: "Error al abrir turno" }, { status: 500 });
    }
  }
  return NextResponse.json<ApiResponse>({ success: false, error: "No se pudo generar folio de caja" }, { status: 500 });
}

/**
 * GET /api/caja/sessions — historial reciente de turnos (para reportes/corte).
 */
export async function GET(request: NextRequest) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });

  const sessions = await prisma.cashSession.findMany({
    where: { tenantId: TENANT },
    include: CASH_SESSION_INCLUDE,
    orderBy: { openedAt: "desc" },
    take: 30,
  });
  return NextResponse.json<ApiResponse>({ success: true, data: sessions });
}
