import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';

const BOT_KEY = process.env.BOT_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const VISION_PROMPT = `Analiza esta imagen con detalle. Primero determina si es un comprobante de transferencia bancaria; si no lo es, identifica que tipo de imagen es y describela con precision.

PASO 1: Es un comprobante de transferencia bancaria SPEI?

SI ES TRANSFERENCIA, responde con JSON exacto:
{"es_transferencia":true,"datos":{"monto":"","fecha":"","referencia_spei":"","clave_rastreo":"","banco_emisor":"","banco_receptor":"","clabe_destino":"","cuenta_destino":"","ordenante":"","beneficiario":"","concepto":""}}

Pon "no visible" en campos que no aparezcan. La referencia_spei suele ser 7 digitos. La clave_rastreo es alfanumerica larga.

SI NO ES TRANSFERENCIA, responde con JSON exacto:
{"es_transferencia":false,"descripcion":"DESCRIPCION DETALLADA","tipo_sugerido":"TIPO"}

Donde DESCRIPCION explica con detalle que es la imagen en 2-4 oraciones. Incluye caracteristicas especificas y relevantes:
- Si es un OBJETO (bolsa, cartera, lentes, etc): describe color, material, marca visible, forma, tamano aproximado y cualquier detalle distintivo que ayude a identificarlo entre otros objetos similares.
- Si es COMIDA: nombra el platillo o tipo de comida, ingredientes visibles, presentacion, y si se ve algun problema (algo crudo, quemado, incompleto).
- Si es una CAPTURA DE CONVERSACION: resume de que trata el chat, que se pregunto o acordo, nombres o datos visibles.
- Si es un MENU o LISTA: menciona platillos y precios visibles.
- Si es UBICACION/MAPA: indica que lugar o direccion se ve.
- Si es EVENTO/CELEBRACION: describe la ocasion (cumpleanos, aniversario) y elementos visibles.
- Si es una PERSONA con un objeto (ej: alguien sosteniendo un bolso): describe tanto el contexto como las caracteristicas del objeto relevante.

TIPO es uno de:
- "captura_conversacion" (screenshot de WhatsApp/chat con burbujas de mensaje)
- "objeto_perdido" (foto de un objeto, sea suelto o sostenido por alguien: bolsa, cartera, lentes, llaves, chamarra, etc)
- "comida_servida" (plato con comida)
- "menu_impreso" (foto de un menu fisico o lista de platillos)
- "ubicacion_mapa" (mapa, screenshot de Google Maps, foto de fachada)
- "evento_celebracion" (cumpleanos, aniversario, fiesta, decoracion)
- "selfie_cliente" (persona o personas, foto personal)
- "documento" (factura, ticket, identificacion, otro documento)
- "producto_consulta" (foto de un platillo/bebida/producto donde el cliente quiere saber que es)
- "otro" (no encaja en categorias anteriores)

Responde UNICAMENTE con JSON valido. Sin markdown, sin backticks.`;

export async function POST(req: NextRequest) {
  const tmpImg = `/tmp/transfer_${Date.now()}.jpg`;

  try {
    const botKey = req.headers.get('x-bot-key');
    if (botKey !== BOT_KEY) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { image_id, wa_token, image_url, plataforma } = await req.json();

    // ── Determinar de donde descargar la imagen ────────────────
    // WhatsApp: viene image_id (hay que resolver la URL via Graph API)
    // Messenger/Instagram: viene image_url directa (o image_id que ya ES una URL)
    let downloadUrl = '';
    let needsAuth = false;

    const looksLikeUrl = (s: string) => typeof s === 'string' && /^https?:\/\//i.test(s);

    if (image_url && looksLikeUrl(image_url)) {
      // Messenger/Instagram: URL directa firmada
      downloadUrl = image_url;
      needsAuth = false;
    } else if (image_id && looksLikeUrl(image_id)) {
      // El image_id ya es una URL (caso Messenger/IG normalizado)
      downloadUrl = image_id;
      needsAuth = false;
    } else if (image_id && wa_token) {
      // WhatsApp: resolver la URL desde el media_id via Graph API
      const mediaResp = execSync(
        `curl -s "https://graph.facebook.com/v25.0/${image_id}" -H "Authorization: Bearer ${wa_token}"`,
        { timeout: 30000 }
      ).toString();
      const parsed = JSON.parse(mediaResp);
      downloadUrl = parsed.url;
      needsAuth = true;
    } else {
      return NextResponse.json({ error: 'Missing image_id/image_url or wa_token' }, { status: 400 });
    }

    if (!downloadUrl) {
      return NextResponse.json({ error: 'No se pudo resolver la URL de la imagen' }, { status: 400 });
    }

    // ── Descargar la imagen ────────────────────────────────────
    const authHeader = needsAuth ? `-H "Authorization: Bearer ${wa_token}"` : '';
    execSync(
      `curl -s -L -o ${tmpImg} "${downloadUrl}" ${authHeader}`,
      { timeout: 30000 }
    );

    const imageBuffer = readFileSync(tmpImg);
    const base64Image = imageBuffer.toString('base64');

    // ── Enviar a GPT-4o Vision ─────────────────────────────────
    const visionBody = JSON.stringify({
      model: 'gpt-4o',
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

    // Si OpenAI devolvio error, propagarlo claramente
    if (visionData.error) {
      return NextResponse.json({
        es_transferencia: false,
        descripcion: 'No se pudo analizar la imagen en este momento.',
        tipo_sugerido: 'otro',
        _openai_error: visionData.error.message || 'error desconocido'
      });
    }

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
