import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffLoginSchema } from "@/lib/validations";
import { verifyPin } from "@/lib/staff-auth";
import {
  signStaffSession,
  staffSessionCookieString,
  type StaffRole,
} from "@/lib/staff-session";
import type { ApiResponse } from "@/types";

/**
 * POST /api/auth/staff/login  { username, pin }
 * Login con PIN para empleados de operación. Emite cookie `sl_staff`.
 * Códigos de error estables para la UI: WRONG_CREDENTIALS, INACTIVE.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = staffLoginSchema.safeParse(body);
    if (!parsed.success) {
      const errors = Object.values(parsed.error.flatten().fieldErrors).flat();
      return NextResponse.json<ApiResponse>(
        { success: false, error: errors.join(", ") },
        { status: 400 }
      );
    }

    const { username, pin } = parsed.data;
    const staff = await prisma.staff.findUnique({
      where: { username: username.toLowerCase() },
    });

    // Mensaje genérico para no revelar si el usuario existe.
    if (!staff || !(await verifyPin(pin, staff.pinHash))) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "WRONG_CREDENTIALS" },
        { status: 401 }
      );
    }

    if (!staff.active) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "INACTIVE" },
        { status: 403 }
      );
    }

    await prisma.staff.update({
      where: { id: staff.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signStaffSession({
      sub: staff.id,
      role: staff.role as StaffRole,
      tenantId: staff.tenantId,
    });
    const res = NextResponse.json<ApiResponse>({
      success: true,
      data: { id: staff.id, username: staff.username, fullName: staff.fullName, role: staff.role },
    });
    res.headers.set("Set-Cookie", staffSessionCookieString(token));
    return res;
  } catch (error) {
    console.error("[API] POST /api/auth/staff/login error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Error al iniciar sesión" },
      { status: 500 }
    );
  }
}
