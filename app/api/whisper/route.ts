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
      `curl -s "https://graph.facebook.com/v19.0/${audio_id}" -H "Authorization: Bearer ${wa_token}"`,
      { timeout: 30000 }
    ).toString();

    const { url } = JSON.parse(mediaResp);

    execSync(
      `curl -s -o ${tmpFile} "${url}" -H "Authorization: Bearer ${wa_token}"`,
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
