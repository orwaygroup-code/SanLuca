// POST /api/whatsapp/webhook
// Llamado por n8n cuando llega un mensaje de WhatsApp.
// n8n envía: { phone, message }
// Devuelve:  { reply }  — n8n lo manda de vuelta al cliente.

import { NextRequest, NextResponse } from "next/server";
import { verifyMetaSignature } from "@/lib/metaSignature";
import { buildBotReply } from "@/lib/botReply";

export async function POST(request: NextRequest) {
    try {
        // Se lee el cuerpo CRUDO antes de parsear: la firma de Meta se calcula sobre
        // los bytes exactos, no sobre el JSON re-serializado.
        const raw = await request.text();
        const body = JSON.parse(raw);

        // ── ROUTER: payload directo de Meta ───────────────────────
        // Meta manda { entry: [...] }, n8n manda { phone, message }
        if (body.entry) {
            // Firma de Meta SOLO en esta rama. Falla cerrado: sin WHATSAPP_APP_SECRET
            // o con firma que no coincide → 401 (el secreto va en .env del VPS ANTES
            // del deploy; si falta, el bot amanece mudo y el smoke lo detecta).
            if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"))) {
                console.error("[whatsapp/webhook] firma de Meta inválida o ausente");
                return NextResponse.json({ error: "invalid signature" }, { status: 401 });
            }

            // Reenviar TODOS los eventos a n8n incondicionalmente
            // (mensajes normales, audio, anuncios Click-to-WhatsApp con referral, etc.)
            fetch("http://localhost:5678/webhook/whatsapp", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify(body),
            }).catch((e) => console.error("[Router → n8n]", e.message));

            // Meta requiere 200 inmediato siempre
            return NextResponse.json({ status: "ok" });
        }

        // ── HANDLER (compatibilidad): llamada de n8n con { phone, message } ────
        // Rama OBSOLETA: n8n debe apuntar a /api/bot/reply (x-bot-key). Se conserva
        // llamando a la misma función hasta que Paul repunte n8n (quitarla = Ola 8 #35).
        const { phone, message } = body as { phone: string; message: string };

        if (!phone || !message) {
            return NextResponse.json({ reply: "No pude procesar tu mensaje." });
        }

        console.warn("[whatsapp/webhook] rama n8n obsoleta: apunta n8n a /api/bot/reply");
        return NextResponse.json({ reply: await buildBotReply(phone, message) });
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

// HEAD — algunas verificaciones de Meta hacen HEAD antes del GET
export async function HEAD() {
    return new Response(null, { status: 200 });
}

// OPTIONS — preflight que Meta puede enviar
export async function OPTIONS() {
    return new Response(null, {
        status: 200,
        headers: { "Allow": "GET, POST, HEAD, OPTIONS" },
    });
}
