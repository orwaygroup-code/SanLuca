import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autoAssignTable } from "@/lib/autoAssignTable";
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

// POST /api/admin/reservations — crea reserva sin restricciones (solo hostess/admin)
export async function POST(request: NextRequest) {
    try {
        const adminId = await verifyStaff(request);
        if (!adminId) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

        const body = await request.json() as {
            guestName:         string;
            guestPhone:        string;
            date:              string; // "YYYY-MM-DD"
            time:              string; // "HH:MM"
            guests:            number;
            sectionPreference?: string;
            notes?:            string;
            occasion?:         string;
        };

        const { guestName, guestPhone, date, time, guests, sectionPreference, notes, occasion } = body;
        if (!guestName || !guestPhone || !date || !time || !guests) {
            return NextResponse.json<ApiResponse>({ success: false, error: "Faltan campos requeridos" }, { status: 400 });
        }

        const reservationDate = new Date(`${date}T${time}:00.000-06:00`);
        if (isNaN(reservationDate.getTime())) {
            return NextResponse.json<ApiResponse>({ success: false, error: "Fecha u hora inválida" }, { status: 400 });
        }

        // Buscar o crear usuario por teléfono
        const phone = guestPhone.replace(/\D/g, "").slice(-10);
        let user = await prisma.user.findFirst({ where: { phone } });
        if (!user) {
            const guestEmail = `${phone}@hostes.guest`;
            user = await prisma.user.upsert({
                where:  { email: guestEmail },
                update: { name: guestName },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                create: { name: guestName, email: guestEmail, phone, role: "CUSTOMER" } as any,
            });
        }

        // Auto-asignar mesa
        const assigned = await autoAssignTable(reservationDate, guests, sectionPreference ?? null);

        const reservation = await prisma.reservation.create({
            data: {
                userId:            user.id,
                guestName,
                guestPhone:        phone,
                guests,
                date:              reservationDate,
                sectionPreference: assigned?.sectionName ?? sectionPreference ?? null,
                notes:             notes ?? null,
                occasion:          occasion ?? null,
                status:            "CONFIRMED",
                paymentStatus:     "UNPAID",
                ...(assigned ? { tableId: assigned.tableId } : {}),
            },
            include: {
                table: { select: { number: true, section: { select: { name: true } } } },
            },
        });

        return NextResponse.json<ApiResponse>({ success: true, data: reservation });
    } catch (error) {
        console.error("[Admin] POST /api/admin/reservations", error);
        return NextResponse.json<ApiResponse>({ success: false, error: "Error al crear reserva" }, { status: 500 });
    }
}
