import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

/**
 * GET /api/comandas/credit-staff — empleados activos que PUEDEN recibir crédito (cuenta a
 * crédito que se salda después / se descuenta de nómina): meseros + cocina/apoyo, etc.
 * A diferencia de /api/comandas/waiters (solo asignables como mesero), aquí SÍ van los
 * KITCHEN. Excluye el sistema "llevar". Realm sl_staff, caja (OPERATION/CAPTAIN/MANAGER).
 */
export async function GET(request: NextRequest) {
  const s = await requireStaffRole(request, ["OPERATION", "CAPTAIN", "MANAGER"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const staff = await prisma.staff.findMany({
    where: { tenantId: TENANT, active: true, username: { not: "llevar" } },
    select: { id: true, fullName: true, role: true },
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
  });
  return NextResponse.json<ApiResponse>({ success: true, data: staff });
}
