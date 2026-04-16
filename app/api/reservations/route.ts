// app/api/reservations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createReservationSchema } from "@/lib/validations";
import { getShiftWindow } from "@/lib/shifts";
import { autoAssignTable } from "@/lib/autoAssignTable";
import type { ApiResponse } from "@/types";

const MAX_ACTIVE_RESERVATIONS = 2;
const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"] as const;

// ──────────────────────────────────────────────
// POST /api/reservations
// Crea una nueva reserva para el usuario autenticado
// ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        // 1. Verificar autenticación
        // NOTA: Adapta esto a tu sistema de auth (NextAuth, Clerk, JWT, etc.)
        // Por ahora usamos el header x-user-id para testing manual con curl/Postman
        const userId =
            request.headers.get("x-user-id") ??
            // request.headers.get("authorization") ?? // para JWT
            null;

        if (!userId) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "No autenticado" },
                { status: 401 }
            );
        }

        // 2. Verificar que el usuario existe
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Usuario no encontrado" },
                { status: 404 }
            );
        }

        // 3. Validar el body con Zod
        const body = await request.json();
        const validation = createReservationSchema.safeParse(body);

        if (!validation.success) {
            const errors = validation.error.flatten().fieldErrors;
            return NextResponse.json<ApiResponse>(
                {
                    success: false,
                    error: Object.values(errors).flat().join(", "),
                },
                { status: 400 }
            );
        }

        const { date, time, tableId, linkedTableId, thirdTableId, isLargeGroup, ...rest } = validation.data;

        // 4. Combinar fecha + hora en un solo DateTime
        // Tratar como hora local de México (UTC-6, sin horario de verano desde 2023)
        const reservationDate = new Date(`${date}T${time}:00.000-06:00`);

        if (isNaN(reservationDate.getTime())) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Fecha u hora inválida" },
                { status: 400 }
            );
        }



        // 6. Verificar límite de reservas activas por usuario
        const activeCount = await prisma.reservation.count({
            where: {
                userId,
                status: { in: [...ACTIVE_STATUSES] },
            },
        });

        if (activeCount >= MAX_ACTIVE_RESERVATIONS) {
            return NextResponse.json<ApiResponse>(
                {
                    success: false,
                    error: `Ya tienes ${MAX_ACTIVE_RESERVATIONS} reservas activas. Cancela una antes de crear otra.`,
                },
                { status: 409 }
            );
        }

        // Rango del día completo (para bloqueos de grupo grande)
        const [y, mo, d] = date.split("-").map(Number);
        const dayStart = new Date(y, mo - 1, d, 0, 0, 0);
        const dayEnd   = new Date(y, mo - 1, d, 23, 59, 59);

        // ── GRUPO GRANDE: verificar que el área completa esté libre todo el día ──
        if (isLargeGroup) {
            const sectionName = rest.sectionPreference;
            if (!sectionName) {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: "Se requiere seleccionar un área para reservas de grupo grande." },
                    { status: 400 }
                );
            }

            const dbSection = await prisma.section.findUnique({
                where: { name: sectionName },
                include: { tables: { where: { isActive: true } } },
            });

            if (!dbSection) {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: `Sección "${sectionName}" no encontrada.` },
                    { status: 404 }
                );
            }

            const sectionTableIds = dbSection.tables.map((t) => t.id);

            const [lgConflict, normalConflict] = await Promise.all([
                // ¿Ya hay otro grupo grande en esta área hoy?
                prisma.reservation.findFirst({
                    where: {
                        isLargeGroup: true,
                        sectionPreference: sectionName,
                        status: { notIn: ["CANCELLED", "NO_SHOW"] },
                        date: { gte: dayStart, lte: dayEnd },
                    },
                }),
                // ¿Hay reservas normales en alguna mesa de esta área hoy?
                prisma.reservation.findFirst({
                    where: {
                        status: { notIn: ["CANCELLED", "NO_SHOW"] },
                        date: { gte: dayStart, lte: dayEnd },
                        OR: [
                            { tableId:       { in: sectionTableIds } },
                            { linkedTableId: { in: sectionTableIds } },
                            { thirdTableId:  { in: sectionTableIds } },
                        ],
                    },
                }),
            ]);

            if (lgConflict || normalConflict) {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: `El área ${sectionName} no está disponible el ${date}. Ya existe otra reserva en esa área para ese día.` },
                    { status: 409 }
                );
            }

            const reservation = await prisma.reservation.create({
                data: {
                    userId,
                    date: reservationDate,
                    isLargeGroup: true,
                    ...rest,
                },
                select: {
                    id: true, guestPhone: true, guestName: true, date: true,
                    guests: true, sectionPreference: true, occasion: true,
                    notes: true, status: true, wantsPreOrder: true,
                    qrToken: true, createdAt: true,
                },
            });

            return NextResponse.json<ApiResponse>({ success: true, data: reservation }, { status: 201 });
        }

        // 7. RESERVA NORMAL: verificar que el área no esté bloqueada por grupo grande
        if (rest.sectionPreference) {
            const lgBlock = await prisma.reservation.findFirst({
                where: {
                    isLargeGroup: true,
                    sectionPreference: rest.sectionPreference,
                    status: { notIn: ["CANCELLED", "NO_SHOW"] },
                    date: { gte: dayStart, lte: dayEnd },
                },
            });
            if (lgBlock) {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: `El área ${rest.sectionPreference} está reservada completa para ese día. Elige otra área u otra fecha.` },
                    { status: 409 }
                );
            }
        }

        // 8. Verificar que la mesa no esté ocupada en este turno
        if (tableId) {
            const { start: shiftStart, end: shiftEnd, name: shiftName } = getShiftWindow(reservationDate);
            const allIds = [tableId, linkedTableId, thirdTableId].filter(Boolean) as string[];
            const tableConflict = await prisma.reservation.findFirst({
                where: {
                    status: { notIn: ["CANCELLED", "NO_SHOW"] },
                    date:   { gte: shiftStart, lt: shiftEnd },
                    OR: allIds.flatMap((id) => [
                        { tableId: id },
                        { linkedTableId: id },
                        { thirdTableId: id },
                    ]),
                },
            });
            if (tableConflict) {
                const turno = shiftName === "brunch" ? "brunch (8am–2pm)" : "cena (2pm–12am)";
                return NextResponse.json<ApiResponse>(
                    { success: false, error: `Esta mesa ya está reservada en el turno de ${turno}. Por favor elige otra mesa u otro turno.` },
                    { status: 409 }
                );
            }
        }

        // 9. Auto-asignar mesa si el usuario no eligió una
        let assignedTableId       = tableId;
        let assignedLinkedTableId = linkedTableId;
        let assignedThirdTableId  = thirdTableId;

        if (!assignedTableId) {
            const assigned = await autoAssignTable(reservationDate, rest.guests, rest.sectionPreference ?? null);
            if (assigned) {
                assignedTableId = assigned.tableId;
                if (!rest.sectionPreference) rest.sectionPreference = assigned.sectionName as "Terraza" | "Planta Alta" | "Salón" | "Privado";
            }
        }

        // 10. Crear la reserva normal
        const reservation = await prisma.reservation.create({
            data: {
                userId,
                date: reservationDate,
                ...(assignedTableId       ? { tableId:       assignedTableId }       : {}),
                ...(assignedLinkedTableId ? { linkedTableId: assignedLinkedTableId } : {}),
                ...(assignedThirdTableId  ? { thirdTableId:  assignedThirdTableId }  : {}),
                ...rest,
            },
            select: {
                id: true,
                guestPhone: true,
                guestName: true,
                date: true,
                guests: true,
                sectionPreference: true,
                occasion: true,
                notes: true,
                status: true,
                wantsPreOrder: true,
                qrToken: true,
                createdAt: true,
            },
        });

        return NextResponse.json<ApiResponse>(
            {
                success: true,
                data: reservation,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("[API] POST /api/reservations error:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Error al crear la reserva" },
            { status: 500 }
        );
    }
}

// ──────────────────────────────────────────────
// GET /api/reservations
// Devuelve las reservas del usuario autenticado
// ──────────────────────────────────────────────
export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get("x-user-id");

        if (!userId) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "No autenticado" },
                { status: 401 }
            );
        }

        const reservations = await prisma.reservation.findMany({
            where: { userId },
            orderBy: { date: "asc" },
            select: {
                id: true,
                guestName: true,
                guestPhone: true,
                date: true,
                guests: true,
                sectionPreference: true,
                occasion: true,
                notes: true,
                status: true,
                paymentStatus: true,
                wantsPreOrder: true,
                qrToken: true,
                table: {
                    select: {
                        number: true,
                        section: { select: { name: true } },
                    },
                },
            },
        });

        return NextResponse.json<ApiResponse>({
            success: true,
            data: reservations,
        });
    } catch (error) {
        console.error("[API] GET /api/reservations error:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Error al obtener reservas" },
            { status: 500 }
        );
    }
}