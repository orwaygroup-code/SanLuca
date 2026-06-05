import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

const MX_TZ = "America/Mexico_City";

/**
 * GET /api/comandas/reservations-today — reservas de HOY con su mesa, para que
 * Operación las "siente" (abre comanda). Realm sl_staff (OPERATION/CAPTAIN/MANAGER).
 * Realm separado del panel admin: Ricardo usa /api/admin/reservations (sl_session).
 */
export async function GET(request: NextRequest) {
  const s = await requireStaffRole(request, ["OPERATION", "CAPTAIN", "MANAGER"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const mxDate = new Intl.DateTimeFormat("en-CA", { timeZone: MX_TZ }).format(new Date()); // YYYY-MM-DD
  const dayStart = new Date(`${mxDate}T00:00:00.000-06:00`);
  const dayEnd = new Date(`${mxDate}T23:59:59.999-06:00`);

  const reservations = await prisma.reservation.findMany({
    where: {
      date: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: {
      id: true, guestName: true, guestPhone: true, date: true, guests: true, status: true,
      sectionPreference: true, tableId: true,
      table: { select: { id: true, number: true, section: { select: { name: true } } } },
      comanda: { select: { id: true, folio: true, status: true } },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json<ApiResponse>({ success: true, data: reservations });
}
