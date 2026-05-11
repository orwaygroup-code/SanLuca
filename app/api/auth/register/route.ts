import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/auth";
import { signSession, sessionCookieString, type Role } from "@/lib/session";
import type { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = registerSchema.safeParse(body);

        if (!validation.success) {
            const errors = validation.error.flatten().fieldErrors;
            const formErrors = validation.error.flatten().formErrors;
            const message = [...formErrors, ...Object.values(errors).flat()].join(", ");
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
            },
            select: { id: true, name: true, email: true, role: true },
        });

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
