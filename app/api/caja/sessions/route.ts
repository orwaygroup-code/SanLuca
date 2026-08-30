import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { verifySupervisorPin } from "@/lib/staff";
import { TENANT, isUniqueViolation, enqueueDrawerKick } from "@/lib/comanda";
import { getShiftWindow } from "@/lib/schedule";
import { getOpenSession, nextCashFolio, CASH_SESSION_INCLUDE } from "@/lib/caja";
import { notify } from "@/lib/notify";
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

  // #1: abrir turno exige PIN de caja (OPERACIÓN/CAPITÁN/MANAGER). El dueño del PIN queda
  // como quien abrió el turno (accountability, aunque la terminal tenga otra sesión).
  const authPin = typeof body?.authPin === "string" ? body.authPin : "";
  const openerId = await verifySupervisorPin(authPin, { tenantId: TENANT, roles: ["OPERATION", "CAPTAIN", "MANAGER"] });
  if (!openerId) {
    return NextResponse.json<ApiResponse>({ success: false, error: "PIN de caja inválido (Operación/Capitán/Manager)" }, { status: 403 });
  }

  const open = await getOpenSession();
  if (open) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: `Ya hay un turno abierto (${open.folio}). Ciérralo antes de abrir otro.` },
      { status: 409 },
    );
  }

  const shift = (await getShiftWindow(new Date())).key;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const created = await prisma.cashSession.create({
        data: {
          tenantId: TENANT,
          folio: await nextCashFolio(),
          registerId,
          shift,
          openingFloat,
          openedById: openerId,
          notes,
        },
        include: CASH_SESSION_INCLUDE,
      });
      // #1: abrir el cajón para meter el fondo inicial (no rompe si el bridge está offline).
      await enqueueDrawerKick({ staffId: openerId, comandaId: null }).catch(() => {});
      void notify({ roles: ["MANAGER"], type: "turno", title: "Apertura de turno", body: `Turno ${created.folio} abierto · fondo ${Number(openingFloat).toFixed(2)}`, url: "/admin/dashboard" });
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
