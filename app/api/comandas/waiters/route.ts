import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

/**
 * GET /api/comandas/waiters — staff activo asignable como mesero de una comanda
 * (WAITER/CAPTAIN/MANAGER). Lo usa el Capitán para reasignar. Realm sl_staff,
 * SOLO CAPTAIN/MANAGER (intervención supervisada).
 */
export async function GET(request: NextRequest) {
  const s = await requireStaffRole(request, ["OPERATION", "CAPTAIN", "MANAGER"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const staff = await prisma.staff.findMany({
    // "llevar" es un mesero de sistema (cuentas para llevar), no una persona → fuera del dropdown.
    where: { tenantId: TENANT, active: true, role: { in: ["WAITER", "CAPTAIN", "MANAGER"] }, username: { not: "llevar" } },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: staff });
}
