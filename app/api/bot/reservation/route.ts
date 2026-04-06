// app/api/bot/reservation/route.ts
// Endpoint para que n8n/WhatsApp bot cree reservas en la BD
// Requiere header: x-bot-key: <BOT_API_KEY>

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── Normaliza teléfono a 10 dígitos ───────────────────────────────────
function normalizePhone(raw: string): string {
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("521") && digits.length === 13) digits = digits.slice(3);
    if (digits.startsWith("52") && digits.length === 12)  digits = digits.slice(2);
    if (digits.startsWith("1")  && digits.length === 11)  digits = digits.slice(1);
    return digits.slice(-10);
}

// ── Parsea fecha "DD/MM/YYYY" o "YYYY-MM-DD" ─────────────────────────
function parseDate(fechaStr: string, horaStr: string): Date | null {
    try {
        let day: number, month: number, year: number;

        if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
            [year, month, day] = fechaStr.split("-").map(Number);
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fechaStr)) {
            [day, month, year] = fechaStr.split("/").map(Number);
        } else {
            return null;
        }

        // Hora: "14:00", "2:00 pm", "2pm"
        let hours = 0, minutes = 0;
        const timeMatch = horaStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            hours   = parseInt(timeMatch[1], 10);
            minutes = parseInt(timeMatch[2] ?? "0", 10);
            const meridiem = timeMatch[3]?.toLowerCase();
            if (meridiem === "pm" && hours !== 12) hours += 12;
            if (meridiem === "am" && hours === 12) hours = 0;
        }

        const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
        return isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
}

// ── POST /api/bot/reservation ─────────────────────────────────────────
export async function POST(request: NextRequest) {
    // 1. Verificar API key del bot
    const botKey = request.headers.get("x-bot-key");
    if (!botKey || botKey !== process.env.BOT_API_KEY) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { titular, celular, personas, zona, fecha, hora } = body;

    if (!titular || !celular || !personas || !fecha || !hora) {
        return NextResponse.json({ success: false, error: "Faltan datos: titular, celular, personas, fecha, hora" }, { status: 400 });
    }

    // 2. Parsear fecha + hora
    const reservationDate = parseDate(fecha, hora);
    if (!reservationDate) {
        return NextResponse.json(
            { success: false, error: `Formato de fecha inválido: "${fecha}" "${hora}". Usar DD/MM/YYYY y HH:MM` },
            { status: 400 }
        );
    }

    // 3. Normalizar teléfono
    const phone = normalizePhone(String(celular));

    // 4. Buscar o crear usuario por teléfono
    //    Si ya tiene cuenta la vinculamos; si no, creamos una cuenta de invitado
    let user = await prisma.user.findFirst({ where: { phone } });
    if (!user) {
        const guestEmail = `${phone}@whatsapp.guest`;
        user = await prisma.user.upsert({
            where:  { email: guestEmail },
            update: { name: titular },
            create: {
                name:  titular,
                email: guestEmail,
                phone,
                role:  "CUSTOMER",
            },
        });
    }

    // 5. Crear la reservación (PENDING — el hostess la confirmará desde el dashboard)
    const reservation = await prisma.reservation.create({
        data: {
            userId:            user.id,
            guestName:         titular,
            guestPhone:        phone,
            guests:            parseInt(String(personas), 10) || 2,
            sectionPreference: zona ?? null,
            date:              reservationDate,
            status:            "PENDING",
            paymentStatus:     "UNPAID",
        },
    });

    return NextResponse.json({
        success: true,
        data: {
            id:      reservation.id,
            qrToken: reservation.qrToken,
            date:    reservation.date,
        },
    });
}
