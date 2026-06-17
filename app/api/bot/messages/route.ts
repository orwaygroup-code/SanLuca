import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("521") && digits.length === 13) digits = digits.slice(3);
  if (digits.startsWith("52")  && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("1")   && digits.length === 11) digits = digits.slice(1);
  return digits.slice(-10);
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

  const phoneNorm = normalizePhone(String(phone));
  const ts = sentAt ? new Date(sentAt) : new Date();
  const platform = typeof plataforma === "string" && plataforma.trim() ? plataforma : "whatsapp";

  const linkedUser = await prisma.user.findFirst({
    where: { phone: phoneNorm },
    select: { id: true },
  });

  const conversation = await prisma.whatsAppConversation.upsert({
    where:  { phone: phoneNorm },
    update: { userId: linkedUser?.id ?? undefined },
    create: { phone: phoneNorm, userId: linkedUser?.id ?? null },
  });

  await prisma.whatsAppMessage.createMany({
    data: [
      {
        conversationId: conversation.id,
        direction: "INBOUND",
        body: String(inbound),
        messageType,
        sentAt: ts,
        mid: typeof mid === "string" && mid.trim() ? mid : null,
        plataforma: platform,
      },
      {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        body: String(outbound),
        messageType: "text",
        sentAt: new Date(ts.getTime() + 1),
        // OUTBOUND no recibe mid del cliente (es la respuesta del bot, no se trackea para borrado de Meta).
        plataforma: platform,
      },
    ],
  });

  return NextResponse.json({ ok: true });
}
