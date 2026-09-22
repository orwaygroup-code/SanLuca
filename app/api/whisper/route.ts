import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/whisper — transcribe un audio de WhatsApp para el bot (Luca).
 * Requiere header x-bot-key (mismo patrón que /api/bot/menu).
 * Body: { audio_id, wa_token }. Baja la media de Meta (Graph v25) y la manda a
 * OpenAI whisper-1 (language=es). Devuelve el JSON de la transcripción tal cual
 * (n8n lee `.text`).
 *
 * Sin shell: usa fetch + FormData (la versión anterior armaba comandos curl con
 * execSync interpolando audio_id/wa_token/url → inyección de comandos; se retiró).
 */
export async function POST(req: NextRequest) {
  const botKey = req.headers.get("x-bot-key");
  if (!botKey || botKey !== process.env.BOT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { audio_id, wa_token } = await req.json().catch(() => ({} as { audio_id?: string; wa_token?: string }));
    if (!audio_id || !wa_token) {
      return NextResponse.json({ error: "Missing audio_id or wa_token" }, { status: 400 });
    }

    // 1) Resolver la URL de la media en Meta.
    const metaResp = await fetch(`https://graph.facebook.com/v25.0/${encodeURIComponent(String(audio_id))}`, {
      headers: { Authorization: `Bearer ${wa_token}` },
      signal: AbortSignal.timeout(30_000),
    });
    const meta = await metaResp.json().catch(() => null);
    const url: string | undefined = meta?.url;
    if (!url) {
      // Meta no devolvió URL (token caducado, media_id inválido, o API deprecada):
      // cortamos aquí con un error claro en vez de mandar un archivo vacío a Whisper.
      console.error("[WHISPER] Meta no devolvió url del audio:", JSON.stringify(meta).slice(0, 300));
      return NextResponse.json({ error: "No se pudo resolver el audio en Meta" }, { status: 502 });
    }

    // 2) Descargar el OGG (la URL de Meta también exige el token).
    const audioResp = await fetch(url, {
      headers: { Authorization: `Bearer ${wa_token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!audioResp.ok) {
      console.error("[WHISPER] descarga de audio falló:", audioResp.status);
      return NextResponse.json({ error: "No se pudo descargar el audio" }, { status: 502 });
    }
    const audioBuf = await audioResp.arrayBuffer();
    const blob = new Blob([audioBuf], { type: meta?.mime_type || "audio/ogg" });

    // 3) Transcribir con OpenAI whisper-1. FormData pone el Content-Type multipart.
    const form = new FormData();
    form.append("file", blob, "audio.ogg");
    form.append("model", "whisper-1");
    form.append("language", "es");
    const oaResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    const result = await oaResp.json().catch(() => null);
    if (!oaResp.ok || !result) {
      console.error("[WHISPER] OpenAI error:", oaResp.status, JSON.stringify(result).slice(0, 300));
      return NextResponse.json({ error: "No se pudo transcribir el audio" }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "whisper_failed";
    console.error("[WHISPER] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
