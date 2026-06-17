// Endpoint llamado por n8n cuando Meta notifica que un usuario borró un mensaje
// en WhatsApp/Messenger/Instagram. Requisito de Meta para el permiso
// `instagram_manage_messages` (y equivalentes en otras plataformas).
//
// Idempotente: si el mid no existe en DB (mensaje anterior al tracking, o ya
// borrado), responde 200 con deleted=false para evitar reintentos.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-bot-key");
  if (!key || key !== process.env.BOT_API_KEY) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { mid, sender, plataforma } = body as { mid?: unknown; sender?: unknown; plataforma?: unknown };

  if (typeof mid !== "string" || mid.trim() === "") {
    return NextResponse.json({ ok: false, error: "mid es requerido" }, { status: 400 });
  }

  const existing = await prisma.whatsAppMessage.findFirst({ where: { mid } });

  if (!existing) {
    return NextResponse.json({
      ok: true,
      deleted: false,
      message: "Mensaje no encontrado en BD (puede ser anterior al tracking de mid)",
      mid,
    });
  }

  await prisma.whatsAppMessage.delete({ where: { id: existing.id } });

  console.log(
    `[DELETE_BY_MID] borrado mid=${mid} plataforma=${plataforma ?? "?"} sender=${sender ?? "?"}`,
  );

  return NextResponse.json({
    ok: true,
    deleted: true,
    message: "Mensaje borrado",
    mid,
    plataforma: typeof plataforma === "string" ? plataforma : null,
  });
}
