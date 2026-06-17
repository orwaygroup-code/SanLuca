// Endpoint llamado por n8n cuando Meta notifica que un usuario borró un mensaje
// en WhatsApp/Messenger/Instagram. Requisito de Meta para el permiso
// `instagram_manage_messages` (y equivalentes en otras plataformas).
//
// Soft delete: el body se vacía (cumple Meta — el contenido del mensaje deja
// de estar almacenado) pero la fila se conserva con deletedAt seteado, así el
// CRM puede renderizar "Este mensaje fue eliminado" en lugar de hacer
// desaparecer el mensaje del hilo (estilo WhatsApp).
//
// Idempotente: si el mid ya fue marcado como eliminado, o no existe en BD,
// responde 200 sin error para evitar reintentos de Meta.

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

  const existing = await prisma.whatsAppMessage.findFirst({
    where: { mid },
    select: { id: true, deletedAt: true },
  });

  if (!existing) {
    return NextResponse.json({
      ok: true,
      deleted: false,
      message: "Mensaje no encontrado en BD (puede ser anterior al tracking de mid)",
      mid,
    });
  }

  if (existing.deletedAt) {
    return NextResponse.json({
      ok: true,
      deleted: false,
      message: "Mensaje ya estaba marcado como eliminado",
      mid,
    });
  }

  // Soft delete: vaciar body + setear deletedAt. Conservamos direction, sentAt,
  // plataforma y mid para que el CRM siga mostrando la fila como "Este mensaje
  // fue eliminado".
  await prisma.whatsAppMessage.update({
    where: { id: existing.id },
    data: { body: "", deletedAt: new Date() },
  });

  console.log(
    `[DELETE_BY_MID] soft-delete mid=${mid} plataforma=${plataforma ?? "?"} sender=${sender ?? "?"}`,
  );

  return NextResponse.json({
    ok: true,
    deleted: true,
    message: "Mensaje marcado como eliminado",
    mid,
    plataforma: typeof plataforma === "string" ? plataforma : null,
  });
}
