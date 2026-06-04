import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import type { ApiResponse } from "@/types";

/**
 * GET /api/auth/staff/me — staff autenticado actual (para el hook de cliente).
 * Devuelve null si no hay sesión o el empleado fue desactivado.
 */
export async function GET(request: NextRequest) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: true, data: null });

  const staff = await prisma.staff.findUnique({
    where: { id: s.staffId },
    select: { id: true, username: true, fullName: true, role: true, active: true },
  });
  if (!staff || !staff.active) {
    return NextResponse.json<ApiResponse>({ success: true, data: null });
  }
  return NextResponse.json<ApiResponse>({ success: true, data: staff });
}
