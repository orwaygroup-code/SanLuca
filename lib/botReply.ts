import { prisma } from "@/lib/prisma";

/**
 * Respuesta de intención del bot de WhatsApp para { phone, message }: busca las
 * reservas activas del teléfono y arma el texto según lo que pregunte el mensaje.
 *
 * Movido íntegro desde app/api/whatsapp/webhook/route.ts (los textos NO cambian):
 * ahora lo consume tanto la ruta nueva /api/bot/reply (n8n con x-bot-key) como la
 * rama de compatibilidad del webhook.
 */

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

export async function buildBotReply(phone: string, message: string): Promise<string> {
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
        },
    });

    const msg = message.toLowerCase();
    const appUrl = process.env.APP_URL ?? "https://sanlucaristorante.com";

    // ── Sin reservas ──────────────────────────────────────────
    if (reservations.length === 0) {
        return `Hola 👋 No encontré ninguna reserva activa asociada a tu número.\n\n` +
            `Puedes hacer una reserva en:\n${appUrl}/reservation`;
    }

    const r = reservations[0];
    const fecha = fmtDate(new Date(r.date));
    const hora  = fmtTime(new Date(r.date));

    // ── Cancelar ──────────────────────────────────────────────
    if (msg.includes("cancelar") || msg.includes("cancel")) {
        return `Para cancelar tu reserva del *${fecha}* a las *${hora}*, comunícate directamente con el restaurante.\n\n` +
            `📞 También puedes llamarnos o escribirnos por aquí y con gusto te ayudamos.`;
    }

    // ── QR / check-in ─────────────────────────────────────────
    // El código QR es una credencial: NO se manda un enlace en respuesta a un
    // teléfono no verificado. Llega por este mismo canal al confirmar la reserva.
    if (msg.includes("qr") || msg.includes("check") || msg.includes("código") || msg.includes("codigo")) {
        return `Tu código QR para la reserva del *${fecha}* llega por este mismo canal cuando la reserva queda confirmada.\n\n` +
            `Preséntalo al llegar al restaurante para tu check-in.`;
    }

    // ── Hora ──────────────────────────────────────────────────
    if (msg.includes("hora") || msg.includes("cuándo") || msg.includes("cuando")) {
        return `Tu próxima reserva es el *${fecha}* a las *${hora}* 🕐`;
    }

    // ── Mesa / sección ────────────────────────────────────────
    if (msg.includes("mesa") || msg.includes("lugar") || msg.includes("sección") || msg.includes("seccion")) {
        const mesa = r.table
            ? `Mesa #${r.table.number} en ${r.table.section.name}`
            : r.sectionPreference
                ? `Sección preferida: ${r.sectionPreference} (mesa por asignar)`
                : "Mesa por asignar";
        return `📍 ${mesa}\nFecha: ${fecha} a las ${hora}`;
    }

    // ── Estado ────────────────────────────────────────────────
    if (msg.includes("estado") || msg.includes("estatus") || msg.includes("confirmada") || msg.includes("confirmar")) {
        return `Estado de tu reserva: *${STATUS_ES[r.status] ?? r.status}*`;
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

    return lines.join("\n");
}
