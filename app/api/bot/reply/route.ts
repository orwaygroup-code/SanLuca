// app/api/bot/reply/route.ts
// Respuesta de intención del bot para n8n (la rama que antes vivía en
// /api/whatsapp/webhook con { phone, message }). Requiere x-bot-key, mismo patrón
// que /api/bot/menu. Body { phone, message } → { reply }.

import { NextRequest, NextResponse } from "next/server";
import { buildBotReply } from "@/lib/botReply";
import type { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
  const botKey = request.headers.get("x-bot-key");
  if (!botKey || botKey !== process.env.BOT_API_KEY) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { phone, message } = await request
    .json()
    .catch(() => ({} as { phone?: string; message?: string }));
  if (!phone || !message) {
    return NextResponse.json<ApiResponse>({ success: false, error: "phone y message requeridos" }, { status: 400 });
  }

  return NextResponse.json({ reply: await buildBotReply(phone, message) });
}
