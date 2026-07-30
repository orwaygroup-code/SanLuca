import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import { signSession, sessionCookieString, type Role } from "@/lib/session";
import type { ApiResponse } from "@/types";

/**
 * GET /api/auth/staff/me — staff autenticado actual (para el hook de cliente).
 * Devuelve null si no hay sesión o el empleado fue desactivado.
 *
 * Puente robusto: si el staff está ligado a un User ADMIN/HOSTES (Ricardo,
 * Francesca), RE-EMITE la cookie sl_session en cada verificación. Así el panel
 * (/admin, /crm) nunca queda sin sesión mientras el PIN siga válido — elimina el
 * loop de redirects (AdminShell ↔ /staff/login) en dispositivos donde el sl_staff
 * sobrevive pero el sl_session se perdió/caducó por separado.
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

  const res = NextResponse.json<ApiResponse>({ success: true, data: staff });

  const linkedUser = await prisma.user.findFirst({
    where: { staffId: staff.id },
    select: { id: true, role: true },
  });
  if (linkedUser && (linkedUser.role === "ADMIN" || linkedUser.role === "HOSTES")) {
    res.headers.append("Set-Cookie", sessionCookieString(signSession({ sub: linkedUser.id, role: linkedUser.role as Role })));
  }
  return res;
}
