import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffLoginSchema } from "@/lib/validations";
import { verifyPin } from "@/lib/staff-auth";
import {
  signStaffSession,
  staffSessionCookieString,
} from "@/lib/staff-session";
import { signSession, sessionCookieString, type Role } from "@/lib/session";
import { allow, reset } from "@/lib/rateLimit";
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

    // Límite de intentos: por usuario y por IP. El de IP va en 60 (no 20): no está
    // verificado que el proxy mande X-Forwarded-For; si no lo manda, todas las tablets
    // comparten bucket, y 60 frena fuerza bruta sin bloquear al local por errores de la mañana.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "sin-ip";
    if (!allow(`staff-login:${parsed.data.username.toLowerCase()}`, 5, 15 * 60_000) ||
        !allow(`staff-login-ip:${ip}`, 60, 15 * 60_000)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
    }

    const staff = await prisma.staff.findUnique({
      where: { username: username.toLowerCase() },
    });

    // Empleado inexistente, desactivado o PIN incorrecto → MISMO fallo: no distinguir
    // un empleado desactivado de credenciales malas (ni por código ni por mensaje).
    if (!staff || !staff.active || !(await verifyPin(pin, staff.pinHash))) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "WRONG_CREDENTIALS" },
        { status: 401 }
      );
    }

    // Login correcto: limpia el contador de intentos de este usuario (misma clave
    // normalizada que el allow y que la consulta a la base).
    reset(`staff-login:${parsed.data.username.toLowerCase()}`);

    await prisma.staff.update({
      where: { id: staff.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signStaffSession({
      sub: staff.id,
      role: staff.role,
      tenantId: staff.tenantId,
    });

    // Puente de identidad: si este Staff está ligado a un User ADMIN/HOSTES
    // (hoy Ricardo y Francesca, vía User.staffId), emite TAMBIÉN la cookie
    // sl_session para que /admin y /crm funcionen con el mismo PIN. `hasAdmin`
    // le dice al login que redirija directo al panel (sin pasar por capitán);
    // solo se marca cuando SÍ se generó la sesión de admin, para no mandar a
    // /admin a un MANAGER sin sesión (eso haría un loop de redirects).
    const linkedUser = await prisma.user.findFirst({
      where: { staffId: staff.id },
      select: { id: true, role: true },
    });
    const hasAdmin = !!linkedUser && (linkedUser.role === "ADMIN" || linkedUser.role === "HOSTES");

    const res = NextResponse.json<ApiResponse>({
      success: true,
      data: { id: staff.id, username: staff.username, fullName: staff.fullName, role: staff.role, hasAdmin },
    });
    res.headers.set("Set-Cookie", staffSessionCookieString(token));
    if (hasAdmin && linkedUser) {
      const userToken = signSession({ sub: linkedUser.id, role: linkedUser.role as Role });
      res.headers.append("Set-Cookie", sessionCookieString(userToken));
    }

    return res;
  } catch (error) {
    console.error("[API] POST /api/auth/staff/login error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Error al iniciar sesión" },
      { status: 500 }
    );
  }
}
