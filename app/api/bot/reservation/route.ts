// app/api/bot/reservation/route.ts
// Endpoint para que n8n/WhatsApp bot cree reservas en la BD
// Requiere header: x-bot-key: <BOT_API_KEY>

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { autoAssignTable } from "@/lib/autoAssignTable";
import { reEvalUserRule } from "@/lib/tagRules";

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

        let hours = 0, minutes = 0;
        const timeMatch = horaStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            hours   = parseInt(timeMatch[1], 10);
            minutes = parseInt(timeMatch[2] ?? "0", 10);
            const meridiem = timeMatch[3]?.toLowerCase();
            if (meridiem === "pm" && hours !== 12) hours += 12;
            if (meridiem === "am" && hours === 12) hours = 0;
        }

        const pad = (n: number) => String(n).padStart(2, "0");
        const d = new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00.000-06:00`);
        return isNaN(d.getTime()) ? null : d;
    } catch {
        return null;
    }
}

// ── Normaliza nombre de zona/seccion para matchear con BD ─────────────
function normalizeZona(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const cleaned = raw
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    if (cleaned.includes("terraza") || cleaned.includes("exterior") || cleaned.includes("afuera")) return "Terraza";
    if (cleaned.includes("planta alta") || cleaned.includes("arriba") || cleaned.includes("segundo piso")) return "Planta Alta";
    if (cleaned.includes("salon") || cleaned.includes("adentro") || cleaned.includes("interior")) return "Salón";
    if (cleaned.includes("privado")) return "Privado";

    return raw.trim();
}

export async function POST(request: NextRequest) {
    const botKey = request.headers.get("x-bot-key");
    if (!botKey || botKey !== process.env.BOT_API_KEY) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { titular, celular, personas, zona, fecha, hora, notes } = body;

    console.log('[BOT_RESERVATION] body recibido:', JSON.stringify(body));
    console.log('[BOT_RESERVATION] zona raw:', zona, '| tipo:', typeof zona);

    if (!titular || !celular || !personas || !fecha || !hora) {
        return NextResponse.json({ success: false, error: "Faltan datos: titular, celular, personas, fecha, hora" }, { status: 400 });
    }

    const reservationDate = parseDate(fecha, hora);
    if (!reservationDate) {
        return NextResponse.json(
            { success: false, error: `Formato de fecha invalido: "${fecha}" "${hora}". Usar DD/MM/YYYY y HH:MM` },
            { status: 400 }
        );
    }

    const guestCount = parseInt(String(personas), 10) || 2;
    const phone = normalizePhone(String(celular));

    const zonaNormalizada = normalizeZona(zona);
    console.log('[BOT_RESERVATION] zona normalizada:', zonaNormalizada);

    let user = await prisma.user.findFirst({ where: { phone } });
    if (!user) {
        const guestEmail = `${phone}@whatsapp.guest`;
        user = await prisma.user.upsert({
            where:  { email: guestEmail },
            update: { name: titular },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            create: {
                name:   titular,
                email:  guestEmail,
                phone,
                role:   "CUSTOMER",
                source: "WHATSAPP",
            } as any,
        });
    }

    const assigned = await autoAssignTable(reservationDate, guestCount, zonaNormalizada);
    console.log('[BOT_RESERVATION] mesa asignada:', assigned);

    const reservation = await prisma.reservation.create({
        data: {
            userId:            user.id,
            guestName:         titular,
            guestPhone:        phone,
            guests:            guestCount,
            sectionPreference: assigned?.sectionName ?? zonaNormalizada ?? null,
            date:              reservationDate,
            status:            "PENDING",
            paymentStatus:     "UNPAID",
            source:            "WHATSAPP",
            notes:             notes && String(notes).trim() ? String(notes).trim() : null,
            ...(assigned ? { tableId: assigned.tableId } : {}),
        },
        include: {
            table: { select: { number: true, section: { select: { name: true } } } },
        },
    });

    // Fire-and-forget: re-evaluar Inactivo (cliente WA volvió a reservar).
    reEvalUserRule(user.id, "Inactivo").catch((e) =>
        console.error("[AUTO_TAG] reEval Inactivo failed (bot reservation):", e),
    );

    return NextResponse.json({
        success: true,
        data: {
            id:               reservation.id,
            qrToken:          reservation.qrToken,
            date:             reservation.date,
            sectionRequested: zonaNormalizada,
            tableInfo:        reservation.table
                ? `Mesa #${reservation.table.number} en ${reservation.table.section.name}`
                : `Sin mesa asignada (zona pedida: ${zonaNormalizada ?? "cualquiera"}) - requiere asignacion manual`,
            notes:            reservation.notes,
        },
    });
}
