import { NextRequest, NextResponse } from "next/server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { autoAssignTable } from "@/lib/autoAssignTable";
import { requireStaff } from "@/lib/auth-server";
import { reEvalUserRule } from "@/lib/tagRules";
import type { ApiResponse } from "@/types";

// GET /api/admin/reservations?section=Terraza&date=2026-04-02&search=juan
export async function GET(request: NextRequest) {
    try {
        const s = await requireStaff(request);
        if (!s) {
            return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const section  = searchParams.get("section");   // "Terraza" | "Planta Alta" | "Salón" | null = todas
        const date     = searchParams.get("date");      // "2026-04-02"
        const search   = searchParams.get("search");    // nombre o teléfono
        const archived = searchParams.get("archived");  // "1" → solo terminales, sin filtro de fecha
        const all      = searchParams.get("all");        // "1" → todas las reservas (cualquier estado/fecha)

        const where: Record<string, unknown> = {};

        if (section && section !== "Todas") {
            where.sectionPreference = section;
        }

        if (all === "1") {
            // Sin filtro de estado ni fecha — todas las reservas
        } else if (archived === "1") {
            where.status = { in: ["CANCELLED", "NO_SHOW", "COMPLETED"] };
            // Sin filtro de fecha — incluye pasadas
        } else if (date) {
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

        const reservations = await runWithSession(s, () =>
            withApp((db) => db.reservation.findMany({
                where,
                orderBy: { date: (archived === "1" || all === "1") ? "desc" : "asc" },
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
                    requiresPayment:   true,
                    creditUsed:        true,
                    amountPaid:        true,
                    checkedInAt:       true,
                    seenAt:            true,
                    tablesProvisional: true,
                    qrToken:           true,
                    table: {
                        select: {
                            number:  true,
                            section: { select: { name: true } },
                        },
                    },
                    user: { select: { name: true, email: true, phone: true } },
                },
            }))
        );

        return NextResponse.json<ApiResponse>({ success: true, data: reservations });
    } catch (error) {
        console.error("[Admin] GET /api/admin/reservations", error);
        return NextResponse.json<ApiResponse>({ success: false, error: "Error al obtener reservas" }, { status: 500 });
    }
}

// POST /api/admin/reservations — crea reserva sin restricciones (solo hostess/admin)
export async function POST(request: NextRequest) {
    try {
        const s = await requireStaff(request);
        if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });
        const adminId = s.userId;

        const body = await request.json() as {
            guestName:          string;
            guestPhone:         string;
            date:               string; // "YYYY-MM-DD"
            time:               string; // "HH:MM"
            guests:             number;
            sectionPreference?: string;
            notes?:             string;
            occasion?:          string;
            isLargeGroup?:      boolean;
            tableId?:           string;
            linkedTableId?:     string;
            thirdTableId?:      string;
            fourthTableId?:     string;
        };

        const { guestName, guestPhone, date, time, guests, sectionPreference, notes, occasion, isLargeGroup, tableId, linkedTableId, thirdTableId, fourthTableId } = body;
        if (!guestName || !guestPhone || !date || !time || !guests) {
            return NextResponse.json<ApiResponse>({ success: false, error: "Faltan campos requeridos" }, { status: 400 });
        }

        const reservationDate = new Date(`${date}T${time}:00.000-06:00`);
        if (isNaN(reservationDate.getTime())) {
            return NextResponse.json<ApiResponse>({ success: false, error: "Fecha u hora inválida" }, { status: 400 });
        }

        const phone = guestPhone.replace(/\D/g, "").slice(-10);

        const reservation = await runWithSession(s, () => withApp(async (db) => {
            // Buscar o crear usuario por teléfono — RLS staff puede insertar/leer
            let user = await db.user.findFirst({ where: { phone } });
            if (!user) {
                const guestEmail = `${phone}@hostes.guest`;
                user = await db.user.upsert({
                    where:  { email: guestEmail },
                    update: { name: guestName },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    create: { name: guestName, email: guestEmail, phone, role: "CUSTOMER" } as any,
                });
            }

            // Auto-asignar mesa solo si no se envía tableId y no es grupo grande
            let assignedTableId = tableId ?? null;
            let assignedSection = sectionPreference ?? null;
            if (!assignedTableId && !isLargeGroup) {
                const assigned = await autoAssignTable(reservationDate, guests, sectionPreference ?? null);
                if (assigned) { assignedTableId = assigned.tableId; assignedSection = assigned.sectionName; }
            }

            return db.reservation.create({
                data: {
                    userId:            user.id,
                    createdById:       adminId,
                    guestName,
                    guestPhone:        phone,
                    guests,
                    date:              reservationDate,
                    isLargeGroup:      isLargeGroup ?? false,
                    sectionPreference: assignedSection,
                    notes:             notes ?? null,
                    occasion:          occasion ?? null,
                    status:            "CONFIRMED",
                    seenAt:            new Date(), // creada por staff en el panel → ya "vista", no parpadea
                    paymentStatus:     "UNPAID",
                    ...(assignedTableId ? { tableId: assignedTableId } : {}),
                    ...(linkedTableId   ? { linkedTableId }            : {}),
                    ...(thirdTableId    ? { thirdTableId }             : {}),
                    ...(fourthTableId   ? { fourthTableId }            : {}),
                },
                include: {
                    table:  { select: { number: true, section: { select: { name: true } } } },
                },
            });
        }));

        // Fire-and-forget: re-evaluar Inactivo (cliente volvió a reservar).
        if (reservation.userId) {
            reEvalUserRule(reservation.userId, "Inactivo").catch((e) =>
                console.error("[AUTO_TAG] reEval Inactivo failed (admin reservation):", e),
            );
        }

        return NextResponse.json<ApiResponse>({ success: true, data: reservation });
    } catch (error) {
        console.error("[Admin] POST /api/admin/reservations", error);
        return NextResponse.json<ApiResponse>({ success: false, error: "Error al crear reserva" }, { status: 500 });
    }
}
