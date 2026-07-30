import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { verifyPassword } from "@/lib/auth";
import { signSession, sessionCookieString, type Role } from "@/lib/session";
import type { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = loginSchema.safeParse(body);

        if (!validation.success) {
            const errors = Object.values(validation.error.flatten().fieldErrors).flat();
            return NextResponse.json<ApiResponse>(
                { success: false, error: errors.join(", ") },
                { status: 400 }
            );
        }

        const { email, password } = validation.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "NOT_REGISTERED" },
                { status: 401 }
            );
        }

        if (!user.passwordHash) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "GOOGLE_ACCOUNT" },
                { status: 401 }
            );
        }
        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "WRONG_CREDENTIALS" },
                { status: 401 }
            );
        }

        // Puente de identidad: los ADMIN entran SOLO por PIN en /staff (que
        // auto-genera esta sesión). Se bloquea el login por correo para que el
        // panel no cuelgue del landing. HOSTES por correo sigue funcionando.
        if (user.role === "ADMIN") {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "USE_PIN" },
                { status: 403 }
            );
        }

        const token = signSession({ sub: user.id, role: user.role as Role });
        const res = NextResponse.json<ApiResponse>({
            success: true,
            data: { id: user.id, name: user.name, email: user.email, role: user.role },
        });
        res.headers.set("Set-Cookie", sessionCookieString(token));
        return res;
    } catch (error) {
        console.error("[API] POST /api/auth/login error:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Error al iniciar sesión" },
            { status: 500 }
        );
    }
}
