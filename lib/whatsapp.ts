const GRAPH_VERSION = "v21.0";

function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    // International format without "+": Meta requires e.g. "5214491234567"
    if (digits.startsWith("52") && digits.length === 12) return digits;
    if (digits.length === 10) return `52${digits}`;
    return digits;
}

export async function sendReservationQR(params: {
    phone: string;
    guestName: string;
    date: Date;
    guests: number;
    sectionPreference?: string | null;
    qrToken: string;
}) {
    const token         = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) throw new Error("WhatsApp credentials not configured");

    const appUrl      = process.env.APP_URL ?? "http://localhost:3000";
    const checkinUrl  = `${appUrl}/checkin/${params.qrToken}`;
    const qrImageUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkinUrl)}`;

    const dateStr = params.date.toLocaleDateString("es-MX", {
        weekday: "long",
        year:    "numeric",
        month:   "long",
        day:     "numeric",
        hour:    "2-digit",
        minute:  "2-digit",
    });

    const section = params.sectionPreference ? `\n📍 ${params.sectionPreference}` : "";

    const caption =
        `¡Hola ${params.guestName}! 🍽️\n\n` +
        `Tu reserva en *San Luca* ha sido registrada.\n\n` +
        `📅 ${dateStr}\n` +
        `👥 ${params.guests} ${params.guests === 1 ? "persona" : "personas"}${section}\n\n` +
        `Guarda este QR y preséntalo al llegar para tu check-in.\n` +
        `También puedes acceder aquí: ${checkinUrl}`;

    const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
        {
            method:  "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type":  "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to:   formatPhone(params.phone),
                type: "image",
                image: {
                    link:    qrImageUrl,
                    caption,
                },
            }),
        }
    );

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`WhatsApp API error: ${JSON.stringify(err)}`);
    }

    return res.json();
}
