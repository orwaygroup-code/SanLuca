import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';

const BOT_KEY = process.env.BOT_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const VISION_PROMPT = `Analiza esta imagen. Determina primero si es un comprobante de transferencia bancaria, y si no, identifica que tipo de imagen es y describela.

PASO 1: Es un comprobante de transferencia bancaria SPEI?

SI ES TRANSFERENCIA, responde con JSON exacto:
{"es_transferencia":true,"datos":{"monto":"","fecha":"","referencia_spei":"","clave_rastreo":"","banco_emisor":"","banco_receptor":"","clabe_destino":"","cuenta_destino":"","ordenante":"","beneficiario":"","concepto":""}}

Pon "no visible" en campos que no aparezcan. La referencia_spei suele ser 7 digitos. La clave_rastreo es alfanumerica larga.

SI NO ES TRANSFERENCIA, responde con JSON exacto:
{"es_transferencia":false,"descripcion":"DESCRIPCION DETALLADA","tipo_sugerido":"TIPO"}

Donde DESCRIPCION explica que es la imagen en 2-3 oraciones (que se ve, contexto), y TIPO es uno de:
- "captura_conversacion" (screenshot de WhatsApp/chat con burbujas de mensaje)
- "objeto_perdido" (foto de un objeto suelto: bolsa, cartera, lentes, llaves, etc)
- "comida_servida" (plato con comida ya en la mesa)
- "menu_impreso" (foto de un menu fisico o lista de platillos)
- "ubicacion_mapa" (mapa, screenshot de Google Maps, foto de fachada)
- "evento_celebracion" (cumpleanos, aniversario, fiesta, decoracion)
- "selfie_cliente" (persona o personas en el restaurante)
- "documento" (factura, ticket, identificacion, otro documento)
- "otro" (no encaja en categorias anteriores)

Responde UNICAMENTE con JSON valido. Sin markdown, sin backticks.`;

export async function POST(req: NextRequest) {
  const tmpImg = `/tmp/transfer_${Date.now()}.jpg`;
  
  try {
    const botKey = req.headers.get('x-bot-key');
    if (botKey !== BOT_KEY) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { image_id, wa_token } = await req.json();

    if (!image_id || !wa_token) {
      return NextResponse.json({ error: 'Missing image_id or wa_token' }, { status: 400 });
    }

    const mediaResp = execSync(
      `curl -s "https://graph.facebook.com/v19.0/${image_id}" -H "Authorization: Bearer ${wa_token}"`,
      { timeout: 30000 }
    ).toString();

    const { url } = JSON.parse(mediaResp);

    execSync(
      `curl -s -o ${tmpImg} "${url}" -H "Authorization: Bearer ${wa_token}"`,
      { timeout: 30000 }
    );

    const imageBuffer = readFileSync(tmpImg);
    const base64Image = imageBuffer.toString('base64');

    const visionBody = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: VISION_PROMPT },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
              detail: 'high'
            }
          }
        ]
      }],
      max_tokens: 1000,
      temperature: 0.1
    });

    const tmpBody = `/tmp/vision_body_${Date.now()}.json`;
    writeFileSync(tmpBody, visionBody);

    const visionResp = execSync(
      `curl -s https://api.openai.com/v1/chat/completions ` +
      `-H "Authorization: Bearer ${OPENAI_KEY}" ` +
      `-H "Content-Type: application/json" ` +
      `-d @${tmpBody}`,
      { timeout: 120000, maxBuffer: 50 * 1024 * 1024 }
    ).toString();

    try { unlinkSync(tmpImg); } catch(e) {}
    try { unlinkSync(tmpBody); } catch(e) {}

    const visionData = JSON.parse(visionResp);
    const content = visionData.choices?.[0]?.message?.content || '';
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      const result = JSON.parse(cleanContent);
      return NextResponse.json(result);
    } catch(e) {
      return NextResponse.json({ 
        es_transferencia: false, 
        descripcion: cleanContent.substring(0, 500),
        tipo_sugerido: 'otro',
      });
    }

  } catch (e: any) {
    try { unlinkSync(tmpImg); } catch(x) {}
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
