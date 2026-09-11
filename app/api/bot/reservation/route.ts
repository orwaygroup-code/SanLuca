// app/api/bot/reservation/route.ts
// Endpoint para que n8n/WhatsApp bot cree reservas en la BD
// Requiere header: x-bot-key: <BOT_API_KEY>

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveBotAssignment } from "@/lib/autoAssignTable";
import { reEvalUserRule } from "@/lib/tagRules";
import { sendReservationQR, buildReservationCaption } from "@/lib/whatsapp";
import { notify } from "@/lib/notify";
import { Prisma } from "@prisma/client";

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

    // "Sin preferencia" / "cualquiera" / "indistinto" → null: NO es una zona literal,
    // se auto-asigna por hora en el handler (antes esto caía como zona inexistente → sin cupo).
    if (cleaned.includes("preferencia") || cleaned.includes("cualquier") || cleaned.includes("indistint")
        || cleaned.includes("la que sea") || cleaned.includes("donde sea") || cleaned === "no") return null;

    return raw.trim();
}

// Sin preferencia → auto-asigna por hora: de día (8:00–16:59) Terraza (afuera);
// de las 17:00 en adelante, Salón (adentro).
function autoZonaPorHora(hora: string | null | undefined): string {
    const m = String(hora ?? "").match(/(\d{1,2}):/);
    const h = m ? Number(m[1]) : 20;
    return h >= 8 && h < 17 ? "Terraza" : "Salón";
}

// Reserva con el include que usan create/findFirst en este endpoint.
type BotReservationWithTable = Prisma.ReservationGetPayload<{
    include: { table: { select: { number: true; section: { select: { name: true } } } } };
}>;

// ── Única forma de respuesta del endpoint ─────────────────────────────
// n8n consume este JSON: NO renombrar, NO anidar distinto, NO quitar campos
// existentes. El único campo nuevo es `duplicate`. La usan el camino normal y
// el de duplicado, para que ambos devuelvan exactamente la misma estructura.
function buildBotReservationResponse(
    reservation: BotReservationWithTable,
    opts: { autoConfirmed: boolean; provisional: boolean; sectionName: string | null; zonaFinal: string | null; duplicate?: boolean },
) {
    const appUrl     = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
    const checkinUrl = opts.autoConfirmed ? `${appUrl}/checkin/${reservation.qrToken}` : null;
    // QR servido desde NUESTRO dominio (PNG) — Meta/Instagram no baja imágenes de hosts externos.
    const qrImageUrl = checkinUrl ? `${appUrl}/api/checkin/${reservation.qrToken}/qr.png` : null;
    const qrCaption  = checkinUrl
        ? buildReservationCaption({
            guestName:         reservation.guestName,
            date:              new Date(reservation.date),
            guests:            reservation.guests,
            sectionPreference: reservation.sectionPreference,
            checkinUrl,
            markdown:          false,
        })
        : null;
    // nº de mesas apartadas = FKs no nulas (equivale a outcome.tableIds.length).
    const tableCount = [reservation.tableId, reservation.linkedTableId, reservation.thirdTableId, reservation.fourthTableId].filter(Boolean).length;
    const tableInfo  = !opts.autoConfirmed
        ? `Sin cupo disponible (zona: ${opts.zonaFinal ?? "cualquiera"}) - requiere asignacion manual`
        : opts.provisional
            ? `Cupo apartado en ${opts.sectionName} (${tableCount} mesas) - la hostess finaliza la combinacion`
            : `Mesa #${reservation.table?.number ?? "?"} en ${reservation.table?.section.name ?? opts.sectionName}`;

    return {
        success: true,
        data: {
            id:               reservation.id,
            autoConfirmed:    opts.autoConfirmed,
            provisional:      opts.provisional,
            qrToken:          reservation.qrToken,
            checkinUrl,
            qrImageUrl,
            qrCaption,
            date:             reservation.date,
            sectionRequested: opts.zonaFinal,
            tableInfo,
            notes:            reservation.notes,
            duplicate:        opts.duplicate ?? false,
        },
    };
}

export async function POST(request: NextRequest) {
    const botKey = request.headers.get("x-bot-key");
    if (!botKey || botKey !== process.env.BOT_API_KEY) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { titular, celular, personas, zona, fecha, hora, notes, canal } = body;
    // canal: "whatsapp" | "instagram" | "messenger" (lo manda n8n). Ausente = whatsapp (compat).
    const channel = String(canal || "whatsapp").toLowerCase();

    // Resumen sin datos personales: `titular` y `celular` identifican al
    // comensal, y estos registros quedan en disco del servidor vía PM2. Se
    // conserva `zona` porque es una preferencia de sala, no un dato del cliente.
    console.log(
        `[BOT_RESERVATION] body recibido: personas=${personas ?? "-"}` +
        ` zona=${JSON.stringify(zona) ?? "-"} fecha=${fecha ?? "-"} hora=${hora ?? "-"}` +
        ` canal=${channel} notas=${notes ? "sí" : "no"}`
    );

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

    // Dedup temprana: el bot reintenta (timeout de n8n, reentrega de webhooks de
    // Meta, el agente LLM reinvoca la herramienta). Misma condición que
    // isSameBotReservation (lib/reservations). Respondemos 200 con la reserva
    // existente, NUNCA 409: el bot trata cualquier no-2xx como fallo y reintenta
    // o le dice al cliente que hubo error cuando ya tiene mesa.
    const existing = await prisma.reservation.findFirst({
        where: {
            guestPhone: phone,
            date:       reservationDate,
            status:     { notIn: ["CANCELLED", "NO_SHOW"] },
        },
        include: { table: { select: { number: true, section: { select: { name: true } } } } },
    });
    if (existing) {
        console.log(`[BOT_RESERVATION] duplicado ignorado: ${existing.id} ya existe para ${phone} @ ${reservationDate.toISOString()}`);
        return NextResponse.json(buildBotReservationResponse(existing, {
            autoConfirmed: existing.status === "CONFIRMED",
            provisional:   existing.tablesProvisional,
            sectionName:   existing.sectionPreference,
            zonaFinal:     existing.sectionPreference,
            duplicate:     true,
        }));
    }

    const zonaNormalizada = normalizeZona(zona);
    // Si el cliente no dio preferencia, se auto-asigna la zona por la hora (Terraza de día, Salón de tarde/noche).
    const zonaFinal = zonaNormalizada ?? autoZonaPorHora(hora);
    console.log('[BOT_RESERVATION] zona normalizada:', zonaNormalizada, '| zona final:', zonaFinal);

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

    const outcome = await resolveBotAssignment(reservationDate, guestCount, zonaFinal);
    console.log('[BOT_RESERVATION] asignación:', outcome);
    const [t1, t2, t3, t4] = outcome?.tableIds ?? [];

    // Lock para ejecuciones paralelas: dos entregas simultáneas de Meta pueden
    // pasar el chequeo del dedup temprano las dos. Serializamos por teléfono con
    // un advisory lock de transacción y RE-comprobamos dentro; si otra ya la creó,
    // devolvemos esa (raceHit) sin volver a crear ni a notificar/mandar QR.
    let raceHit = false;
    const reservation = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"bot-reserva:" + phone}))`;
        const race = await tx.reservation.findFirst({
            where: { guestPhone: phone, date: reservationDate, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
            include: { table: { select: { number: true, section: { select: { name: true } } } } },
        });
        if (race) { raceHit = true; return race; }
        return tx.reservation.create({
            data: {
                userId:            user.id,
                guestName:         titular,
                guestPhone:        phone,
                guests:            guestCount,
                sectionPreference: outcome?.sectionName ?? zonaFinal ?? null,
                date:              reservationDate,
                // Confirma por disponibilidad: si hay cupo (1 mesa o mesas apartadas)
                // nace CONFIRMED y se manda el QR. Si son mesas apartadas, la hostess
                // finaliza la combinación (tablesProvisional). Sin cupo → PENDING.
                status:            outcome ? "CONFIRMED" : "PENDING",
                tablesProvisional: outcome?.provisional ?? false,
                paymentStatus:     "UNPAID",
                source:            "WHATSAPP",
                notes:             notes && String(notes).trim() ? String(notes).trim() : null,
                ...(t1 ? { tableId:       t1 } : {}),
                ...(t2 ? { linkedTableId: t2 } : {}),
                ...(t3 ? { thirdTableId:  t3 } : {}),
                ...(t4 ? { fourthTableId: t4 } : {}),
            },
            include: {
                table: { select: { number: true, section: { select: { name: true } } } },
            },
        });
    });

    // Efectos secundarios SOLO si de verdad creamos la reserva. Si fue un raceHit,
    // `reservation` es una existente que creó otra ejecución paralela: no re-notificar
    // ni re-enviar el QR (el cliente ya lo recibió cuando se creó).
    if (!raceHit) {
        // Notifica a managers + caja/hostess (Operación) la reserva nueva del bot.
        void notify({
            roles: ["MANAGER", "OPERATION"],
            type: "reserva",
            title: "Nueva reserva (WhatsApp)",
            body: `${reservation.guestName} · ${reservation.guests} pers · ${new Date(reservation.date).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}${reservation.sectionPreference ? ` · ${reservation.sectionPreference}` : ""}${reservation.status === "PENDING" ? " · SIN CUPO (revisar)" : ""}`,
            url: "/admin",
        });

        // Fire-and-forget: re-evaluar Inactivo (cliente WA volvió a reservar).
        reEvalUserRule(user.id, "Inactivo").catch((e) =>
            console.error("[AUTO_TAG] reEval Inactivo failed (bot reservation):", e),
        );

        // Auto-confirmación: si hay mesa, se envía el QR. Solo por WhatsApp cuando el
        // canal es WhatsApp — en Instagram/Messenger el QR lo manda n8n de vuelta al
        // MISMO chat (paridad de canal), así que aquí NO se envía por WhatsApp para no
        // duplicar. Fire-and-forget: un fallo de envío NO tumba la creación.
        if (outcome && channel === "whatsapp") {
            sendReservationQR({
                phone:             reservation.guestPhone,
                guestName:         reservation.guestName,
                date:              new Date(reservation.date),
                guests:            reservation.guests,
                sectionPreference: reservation.sectionPreference,
                qrToken:           reservation.qrToken,
            }).catch((e) => console.error("[WhatsApp QR bot auto-confirm]", e));
        }
    }

    // Una sola forma de respuesta. Si fue raceHit, reflejamos el estado REAL de la
    // reserva existente (no el `outcome` que calculamos y no usamos) y marcamos duplicate.
    return NextResponse.json(
        buildBotReservationResponse(
            reservation,
            raceHit
                ? {
                    autoConfirmed: reservation.status === "CONFIRMED",
                    provisional:   reservation.tablesProvisional,
                    sectionName:   reservation.sectionPreference,
                    zonaFinal:     reservation.sectionPreference,
                    duplicate:     true,
                }
                : {
                    autoConfirmed: !!outcome,
                    provisional:   outcome?.provisional ?? false,
                    sectionName:   outcome?.sectionName ?? null,
                    zonaFinal:     zonaFinal,
                    duplicate:     false,
                },
        ),
    );
}
