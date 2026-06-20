import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Normaliza el identificador del remitente a la llave de conversación.
 *
 * - WhatsApp: el `phone` ES un teléfono real → lógica MX (quita 521/52/1,
 *   conserva los últimos 10 dígitos) para que matchee con `User.phone`.
 * - Messenger / Instagram: el `phone` que manda n8n es en realidad el
 *   PSID/IGSID (ID de 15-17 dígitos), NO un teléfono. Mutilarlo con slice(-10)
 *   produce una llave inestable/colisionable → se conserva COMPLETO.
 */
function normalizeIdentity(raw: string, platform: string): string {
  const digits = raw.replace(/\D/g, "");
  if (platform === "messenger" || platform === "instagram") {
    return digits; // PSID/IGSID completo, sin mutilar
  }
  // WhatsApp (teléfono MX)
  let d = digits;
  if (d.startsWith("521") && d.length === 13) d = d.slice(3);
  if (d.startsWith("52")  && d.length === 12) d = d.slice(2);
  if (d.startsWith("1")   && d.length === 11) d = d.slice(1);
  return d.slice(-10);
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-bot-key");
  if (!key || key !== process.env.BOT_API_KEY) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    phone,
    inbound,
    outbound,
    sentAt,
    messageType = "text",
    mid,           // ID del mensaje INBOUND en Meta (para tracking de borrado)
    plataforma,    // 'whatsapp' | 'messenger' | 'instagram'
  } = body;

  if (!phone || !inbound || !outbound) {
    return NextResponse.json({ ok: false, error: "Faltan campos: phone, inbound, outbound" }, { status: 400 });
  }

  const platform = typeof plataforma === "string" && plataforma.trim() ? plataforma : "whatsapp";
  const identity = normalizeIdentity(String(phone), platform);
  const ts = sentAt ? new Date(sentAt) : new Date();

  // Vínculo a User registrado solo aplica a WhatsApp (User.phone es teléfono).
  // Para Messenger/IG la identity es un PSID que nunca matchea un teléfono → null.
  const linkedUser = await prisma.user.findFirst({
    where: { phone: identity },
    select: { id: true },
  });

  const conversation = await prisma.whatsAppConversation.upsert({
    where:  { phone: identity },
    update: { userId: linkedUser?.id ?? undefined },
    create: { phone: identity, userId: linkedUser?.id ?? null },
  });

  const cleanMid = typeof mid === "string" && mid.trim() ? mid : null;

  // skipDuplicates: si Meta re-entrega el webhook (común en Messenger/IG) y el
  // `mid` ya existe, se omite esa fila en vez de tronar el insert completo.
  // try/catch: si algo más falla, lo logueamos con contexto en vez de un 500
  // silencioso que bloquea el registro de la conversación.
  try {
    await prisma.whatsAppMessage.createMany({
      data: [
        {
          conversationId: conversation.id,
          direction: "INBOUND",
          body: String(inbound),
          messageType,
          sentAt: ts,
          mid: cleanMid,
          plataforma: platform,
        },
        {
          conversationId: conversation.id,
          direction: "OUTBOUND",
          body: String(outbound),
          messageType: "text",
          sentAt: new Date(ts.getTime() + 1),
          // OUTBOUND no recibe mid del cliente (respuesta del bot, no se trackea).
          plataforma: platform,
        },
      ],
      skipDuplicates: true,
    });
  } catch (e) {
    console.error(
      `[BOT_MESSAGES] insert falló — platform=${platform} identity=${identity} mid=${cleanMid ?? "null"}`,
      e,
    );
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
