import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ApiResponse } from "@/types";

async function verifyStaff(request: NextRequest) {
    const userId = request.headers.get("x-user-id");
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    return user && ["ADMIN", "HOSTES"].includes(user.role) ? userId : null;
}

// GET /api/admin/reservations?section=Terraza&date=2026-04-02&search=juan
export async function GET(request: NextRequest) {
    try {
        const adminId = await verifyStaff(request);
        if (!adminId) {
            return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const section = searchParams.get("section");   // "Terraza" | "Planta Alta" | "Salón" | null = todas
        const date    = searchParams.get("date");      // "2026-04-02"
        const search  = searchParams.get("search");    // nombre o teléfono

        const where: Record<string, unknown> = {};

        if (section && section !== "Todas") {
            where.sectionPreference = section;
        }

        if (date) {
            // Interpretar la fecha en timezone de México (UTC-6 fijo, sin horario de verano)
            const start = new Date(`${date}T00:00:00.000-06:00`);
            const end   = new Date(`${date}T23:59:59.999-06:00`);
            where.date = { gte: start, lte: end };
        } else {
            // Sin filtro de fecha: mostrar hoy y futuro en tiempo de México
            const nowMx   = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
            const dateMx  = `${nowMx.getFullYear()}-${String(nowMx.getMonth() + 1).padStart(2, "0")}-${String(nowMx.getDate()).padStart(2, "0")}`;
            const todayStart = new Date(`${dateMx}T00:00:00.000-06:00`);
            where.date = { gte: todayStart };
        }

        if (search) {
            where.OR = [
                { guestName:  { contains: search, mode: "insensitive" } },
                { guestPhone: { contains: search } },
            ];
        }

        const reservations = await prisma.reservation.findMany({
            where,
            orderBy: { date: "asc" },
            select: {
                id:                true,
                guestName:         true,
                guestPhone:        true,
                date:              true,
                guests:            true,
                sectionPreference: true,
                occasion:          true,
                notes:             true,
                status:            true,
                paymentStatus:     true,
                checkedInAt:       true,
                qrToken:           true,
                table: {
                    select: {
                        number:  true,
                        section: { select: { name: true } },
                    },
                },
                user: { select: { name: true, email: true, phone: true } },
            },
        });

        return NextResponse.json<ApiResponse>({ success: true, data: reservations });
    } catch (error) {
        console.error("[Admin] GET /api/admin/reservations", error);
        return NextResponse.json<ApiResponse>({ success: false, error: "Error al obtener reservas" }, { status: 500 });
    }
}
