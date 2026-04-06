// POST /api/whatsapp/webhook
// Llamado por n8n cuando llega un mensaje de WhatsApp.
// n8n envía: { phone, message }
// Devuelve:  { reply }  — n8n lo manda de vuelta al cliente.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function formatPhone(raw: string): string {
    const d = raw.replace(/\D/g, "");
    if (d.startsWith("52") && d.length === 12) return d.slice(2); // quitar código de país
    if (d.length === 10) return d;
    return d.length > 10 ? d.slice(-10) : d;
}

function fmtDate(d: Date) {
    return d.toLocaleDateString("es-MX", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
}
function fmtTime(d: Date) {
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_ES: Record<string, string> = {
    PENDING:     "Pendiente de confirmación",
    CONFIRMED:   "Confirmada ✅",
    IN_PROGRESS: "En curso 🍽️",
    DELAYED:     "Con retraso ⏳",
    CANCELLED:   "Cancelada ❌",
    COMPLETED:   "Completada ✓",
    NO_SHOW:     "No se presentó",
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // ── ROUTER: payload directo de Meta ───────────────────────
        // Meta manda { entry: [...] }, n8n manda { phone, message }
        if (body.entry) {
            const value   = body.entry?.[0]?.changes?.[0]?.value;
            const message = value?.messages?.[0];

            // Texto y audio → n8n los maneja (audio pasa por Whisper en n8n)
            if (message?.type === "text" || message?.type === "audio") {
                // Fire-and-forget → n8n (no bloqueamos la respuesta a Meta)
                fetch("http://localhost:5678/webhook/whatsapp", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify(body),
                }).catch((e) => console.error("[Router → n8n]", e.message));
            }

            // Meta requiere 200 inmediato siempre
            return NextResponse.json({ status: "ok" });
        }

        // ── HANDLER: llamada de n8n con { phone, message } ────────
        const { phone, message } = body as { phone: string; message: string };

        if (!phone || !message) {
            return NextResponse.json({ reply: "No pude procesar tu mensaje." });
        }

        const localPhone = formatPhone(phone);

        // Buscar reservas activas por teléfono del titular
        const reservations = await prisma.reservation.findMany({
            where: {
                guestPhone:   { contains: localPhone },
                status:       { notIn: ["CANCELLED", "NO_SHOW"] },
            },
            orderBy: { date: "asc" },
            take: 3,
            select: {
                id:                true,
                guestName:         true,
                date:              true,
                guests:            true,
                sectionPreference: true,
                status:            true,
                paymentStatus:     true,
                table:             { select: { number: true, section: { select: { name: true } } } },
                qrToken:           true,
            },
        });

        const msg = message.toLowerCase();
        const appUrl = process.env.APP_URL ?? "https://sanlucaristorante.com";

        // ── Sin reservas ──────────────────────────────────────────
        if (reservations.length === 0) {
            return NextResponse.json({
                reply:
                    `Hola 👋 No encontré ninguna reserva activa asociada a tu número.\n\n` +
                    `Puedes hacer una reserva en:\n${appUrl}/reservation`,
            });
        }

        const r = reservations[0];
        const fecha = fmtDate(new Date(r.date));
        const hora  = fmtTime(new Date(r.date));

        // ── Cancelar ──────────────────────────────────────────────
        if (msg.includes("cancelar") || msg.includes("cancel")) {
            return NextResponse.json({
                reply:
                    `Para cancelar tu reserva del *${fecha}* a las *${hora}*, comunícate directamente con el restaurante.\n\n` +
                    `📞 También puedes llamarnos o escribirnos por aquí y con gusto te ayudamos.`,
            });
        }

        // ── QR / check-in ─────────────────────────────────────────
        if (msg.includes("qr") || msg.includes("check") || msg.includes("código") || msg.includes("codigo")) {
            const qrUrl = `${appUrl}/checkin/${r.qrToken}`;
            return NextResponse.json({
                reply:
                    `Tu código QR para la reserva del *${fecha}*:\n\n` +
                    `🔗 ${qrUrl}\n\n` +
                    `Preséntalo al llegar al restaurante para tu check-in.`,
            });
        }

        // ── Hora ──────────────────────────────────────────────────
        if (msg.includes("hora") || msg.includes("cuándo") || msg.includes("cuando")) {
            return NextResponse.json({
                reply: `Tu próxima reserva es el *${fecha}* a las *${hora}* 🕐`,
            });
        }

        // ── Mesa / sección ────────────────────────────────────────
        if (msg.includes("mesa") || msg.includes("lugar") || msg.includes("sección") || msg.includes("seccion")) {
            const mesa = r.table
                ? `Mesa #${r.table.number} en ${r.table.section.name}`
                : r.sectionPreference
                    ? `Sección preferida: ${r.sectionPreference} (mesa por asignar)`
                    : "Mesa por asignar";
            return NextResponse.json({
                reply: `📍 ${mesa}\nFecha: ${fecha} a las ${hora}`,
            });
        }

        // ── Estado ────────────────────────────────────────────────
        if (msg.includes("estado") || msg.includes("estatus") || msg.includes("confirmada") || msg.includes("confirmar")) {
            return NextResponse.json({
                reply: `Estado de tu reserva: *${STATUS_ES[r.status] ?? r.status}*`,
            });
        }

        // ── Respuesta por defecto: resumen completo ────────────────
        const mesa = r.table
            ? `#${r.table.number} - ${r.table.section.name}`
            : r.sectionPreference ?? "Por asignar";

        const lines = [
            `¡Hola ${r.guestName}! 🍽️ Aquí el resumen de tu reserva en *San Luca*:\n`,
            `📅 *${fecha}*`,
            `🕐 ${hora}`,
            `👥 ${r.guests} persona${r.guests !== 1 ? "s" : ""}`,
            `📍 ${mesa}`,
            `✅ Estado: ${STATUS_ES[r.status] ?? r.status}`,
        ];

        if (reservations.length > 1) {
            lines.push(`\nTienes ${reservations.length} reservas activas. Escribe *"reservas"* para ver todas.`);
        }

        lines.push(`\nPuedes preguntar por: *hora*, *mesa*, *QR*, *estado* o *cancelar*.`);

        return NextResponse.json({ reply: lines.join("\n") });
    } catch (error) {
        console.error("[WhatsApp webhook]", error);
        return NextResponse.json({ reply: "Ocurrió un error. Intenta de nuevo." });
    }
}

// GET para verificación del webhook de Meta (si se conecta directo)
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mode      = searchParams.get("hub.mode");
    const token     = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === (process.env.WHATSAPP_VERIFY_TOKEN ?? "sanluca-webhook")) {
        return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
}
