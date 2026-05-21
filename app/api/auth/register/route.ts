import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/auth";
import { signSession, sessionCookieString, type Role } from "@/lib/session";
import { reEvalUserRule } from "@/lib/tagRules";
import type { ApiResponse } from "@/types";

/** Versión actual de los documentos legales aceptados al registrarse. */
const TERMS_VERSION = "1.0";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = registerSchema.safeParse(body);

        if (!validation.success) {
            const errors = validation.error.flatten().fieldErrors;
            const formErrors = validation.error.flatten().formErrors;
            // Si el único error es `acceptedTerms`, devolvemos el código TERMS_REQUIRED
            // para que el frontend pueda mostrar el mensaje específico del checkbox.
            const flat = [...formErrors, ...Object.values(errors).flat()];
            if (flat.length === 1 && flat[0] === "TERMS_REQUIRED") {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: "TERMS_REQUIRED" },
                    { status: 400 }
                );
            }
            const message = flat.join(", ");
            return NextResponse.json<ApiResponse>(
                { success: false, error: message },
                { status: 400 }
            );
        }

        const { name, email, phone, birthDate, password } = validation.data;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Este email ya está registrado" },
                { status: 409 }
            );
        }

        const passwordHash = await hashPassword(password);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                phone,
                birthDate: birthDate ? new Date(birthDate) : undefined,
                passwordHash,
                acceptedTermsAt:      new Date(),
                acceptedTermsVersion: TERMS_VERSION,
            },
            select: { id: true, name: true, email: true, role: true, birthDate: true },
        });

        // Fire-and-forget: si el birthDate cae en el mes actual MX (UTC-6),
        // disparar la regla Cumpleañero inmediatamente — no esperar al cron.
        // El tag cubre el MES completo (no día).
        if (user.birthDate) {
            const mxOffsetMs = 6 * 3600 * 1000;
            const currentMonthMX = new Date(Date.now() - mxOffsetMs).getUTCMonth();
            if (user.birthDate.getUTCMonth() === currentMonthMX) {
                reEvalUserRule(user.id, "Cumpleañero").catch((e) =>
                    console.error("[AUTO_TAG] reEval Cumpleañero failed (register):", e),
                );
            }
        }

        const token = signSession({ sub: user.id, role: user.role as Role });
        const res = NextResponse.json<ApiResponse>(
            { success: true, data: user },
            { status: 201 }
        );
        res.headers.set("Set-Cookie", sessionCookieString(token));
        return res;
    } catch (error) {
        console.error("[API] POST /api/auth/register error:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Error al crear la cuenta" },
            { status: 500 }
        );
    }
}
