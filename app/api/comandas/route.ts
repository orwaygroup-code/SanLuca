import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import { getShiftWindow } from "@/lib/shifts";
import { formatFolio } from "@/lib/comandaRules";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE, isUniqueViolation, uniqueViolationTarget } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

const MX_TZ = "America/Mexico_City";
function mxYear(): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: MX_TZ, year: "numeric" }).format(new Date()));
}

/**
 * POST /api/comandas — abre una comanda en una mesa. Cualquier staff (WAITER+).
 * Body: { tableId, guests, reservationId?, waiterId?, notes? }
 * - waiterId default = quien abre (si es WAITER, él mismo).
 * - shift se detecta por la hora actual (brunch/cena).
 * - folio COM-AAAA-NNNN secuencial por año, con reintento ante carrera.
 */
export async function POST(request: NextRequest) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { tableId, guests, reservationId, waiterId, notes } = body || {};
  if (typeof tableId !== "string" || typeof guests !== "number" || guests < 1) {
    return NextResponse.json<ApiResponse>({ success: false, error: "tableId y guests son obligatorios" }, { status: 400 });
  }

  const table = await prisma.table.findFirst({ where: { id: tableId }, select: { id: true } });
  if (!table) return NextResponse.json<ApiResponse>({ success: false, error: "Mesa no encontrada" }, { status: 404 });

  // Una mesa no puede tener 2 comandas activas a la vez.
  const busy = await prisma.comanda.findFirst({
    where: { tenantId: TENANT, tableId, status: { in: [...ACTIVE_STATUSES] } },
    select: { id: true, folio: true },
  });
  if (busy) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: `La mesa ya tiene una comanda activa (${busy.folio})` },
      { status: 409 },
    );
  }

  // Si se especifica un waiterId distinto, validar que exista y esté activo
  // (espejo de change-waiter). Evita FK 500 y comandas abiertas a nombre equivocado.
  if (typeof waiterId === "number") {
    const w = await prisma.staff.findFirst({
      where: { id: waiterId, tenantId: TENANT, active: true },
      select: { id: true },
    });
    if (!w) return NextResponse.json<ApiResponse>({ success: false, error: "Mesero no encontrado o inactivo" }, { status: 404 });
  }

  const shift = getShiftWindow(new Date()).name;
  const year = mxYear();
  const baseData = {
    tenantId: TENANT,
    tableId,
    reservationId: typeof reservationId === "string" ? reservationId : null,
    guestsActual: guests,
    waiterId: typeof waiterId === "number" ? waiterId : s.staffId,
    openedById: s.staffId,
    shift,
    notes: typeof notes === "string" ? notes : null,
  };

  // Folio con reintento: cuenta las comandas del año y reintenta si choca el unique.
  let seq = (await prisma.comanda.count({
    where: { tenantId: TENANT, folio: { startsWith: `COM-${year}-` } },
  })) + 1;

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const created = await prisma.comanda.create({
        data: { ...baseData, folio: formatFolio(year, seq) },
        include: COMANDA_INCLUDE,
      });
      return NextResponse.json<ApiResponse>({ success: true, data: created }, { status: 201 });
    } catch (e) {
      if (isUniqueViolation(e)) {
        // Distinguir el constraint: si chocó reservationId, reintentar el folio
        // es inútil (siempre fallará) → 409 con mensaje claro. Solo el choque de
        // folio justifica subir el seq y reintentar.
        if (uniqueViolationTarget(e).includes("reservation")) {
          return NextResponse.json<ApiResponse>({ success: false, error: "Esa reserva ya tiene una comanda" }, { status: 409 });
        }
        seq++; continue; // colisión de folio → reintentar
      }
      console.error("[API] POST /api/comandas error:", e);
      return NextResponse.json<ApiResponse>({ success: false, error: "Error al crear comanda" }, { status: 500 });
    }
  }
  return NextResponse.json<ApiResponse>({ success: false, error: "No se pudo generar folio único" }, { status: 500 });
}

/**
 * GET /api/comandas — comandas activas. WAITER ve solo las suyas; OPERATION+ todas.
 */
export async function GET(request: NextRequest) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const onlyMine = s.role === "WAITER";
  const comandas = await prisma.comanda.findMany({
    where: {
      tenantId: TENANT,
      status: { in: [...ACTIVE_STATUSES] },
      ...(onlyMine ? { waiterId: s.staffId } : {}),
    },
    include: COMANDA_INCLUDE,
    orderBy: { openedAt: "asc" },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: comandas });
}
