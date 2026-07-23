import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';

export async function POST(req: NextRequest) {
  const tmpFile = `/tmp/whisper_${Date.now()}.ogg`;
  try {
    const { audio_id, wa_token } = await req.json();

    if (!audio_id || !wa_token) {
      return NextResponse.json({ error: 'Missing audio_id or wa_token' }, { status: 400 });
    }

    const mediaResp = execSync(
      `curl -s "https://graph.facebook.com/v25.0/${audio_id}" -H "Authorization: Bearer ${wa_token}"`,
      { timeout: 30000 }
    ).toString();

    const parsed = JSON.parse(mediaResp);
    const url: string | undefined = parsed?.url;
    if (!url) {
      // Meta no devolvió URL (token caducado, media_id inválido, o versión de
      // API deprecada): cortamos aquí con un error claro en vez de pasar
      // "undefined" al curl de descarga y luego un archivo vacío a Whisper.
      console.error("[WHISPER] Meta no devolvió url del audio:", mediaResp.slice(0, 300));
      return NextResponse.json({ error: "No se pudo resolver el audio en Meta" }, { status: 502 });
    }

    execSync(
      `curl -s -L -o ${tmpFile} "${url}" -H "Authorization: Bearer ${wa_token}"`,
      { timeout: 30000 }
    );

    const result = execSync(
      'curl -s https://api.openai.com/v1/audio/transcriptions ' +
      `-H "Authorization: Bearer ${process.env.OPENAI_API_KEY}" ` +
      `-F "file=@${tmpFile}" ` +
      '-F "model=whisper-1" ' +
      '-F "language=es"',
      { timeout: 120000 }
    ).toString();

    try { unlinkSync(tmpFile); } catch(e) {}
    return NextResponse.json(JSON.parse(result));
  } catch (e: any) {
    try { unlinkSync(tmpFile); } catch(x) {}
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
