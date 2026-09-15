// POST /api/whatsapp/webhook
// Receptor FIRMADO de Meta: valida X-Hub-Signature-256 y reenvía el evento a n8n.
// La respuesta de intención al cliente la da n8n vía /api/bot/reply (x-bot-key);
// esta ruta ya no atiende la forma vieja de n8n.

import { NextRequest, NextResponse } from "next/server";
import { verifyMetaSignature } from "@/lib/metaSignature";

export async function POST(request: NextRequest) {
    try {
        // Se lee el cuerpo CRUDO antes de parsear: la firma de Meta se calcula sobre
        // los bytes exactos, no sobre el JSON re-serializado.
        const raw = await request.text();
        const body = JSON.parse(raw);

        // ── ROUTER: payload directo de Meta ───────────────────────
        // Meta manda { entry: [...] }; cualquier otra forma se rechaza abajo.
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

        // Cualquier otro body no viene de Meta firmado: n8n usa /api/bot/reply.
        return NextResponse.json({ error: "unsupported payload" }, { status: 400 });
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

    // Sin fallback: si WHATSAPP_VERIFY_TOKEN no está definido, nadie completa el
    // handshake de suscripción (403). Solo afecta a re-suscribir el webhook en Meta.
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (expected && mode === "subscribe" && token === expected) {
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
