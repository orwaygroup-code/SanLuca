import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

/**
 * GET /api/staff/employee-charges — #4 Cuentas (para llevar) ligadas al empleado logueado
 * que están activas: PENDING (por aprobar) y APPROVED (aprobadas, aún sin cobrar). Es la
 * "cola de aprobación" que ve el empleado en su Cartera. Solo lectura.
 */
export async function GET(request: NextRequest) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });
  if (actor.staffId == null) return NextResponse.json<ApiResponse>({ success: true, data: [] });

  const comandas = await prisma.comanda.findMany({
    where: {
      tenantId: TENANT,
      chargedEmployeeId: actor.staffId,
      employeeChargeStatus: { in: ["PENDING", "APPROVED"] },
      status: { in: [...ACTIVE_STATUSES] },
    },
    orderBy: [{ employeeChargeStatus: "asc" }, { openedAt: "asc" }], // APPROVED antes que PENDING alfabéticamente; da igual, se separan en UI
    select: {
      id: true, folio: true, customName: true, total: true, openedAt: true,
      employeeChargeStatus: true, employeeChargeApprovedAt: true,
      openedBy: { select: { fullName: true } },
      items: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { id: "asc" },
        select: { id: true, quantity: true, dishNameSnapshot: true, lineTotal: true },
      },
    },
  });

  return NextResponse.json<ApiResponse>({ success: true, data: comandas });
}
