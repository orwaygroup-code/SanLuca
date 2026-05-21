/**
 * Cliente OpenAI para el cron de auto-tagging semántico (AUTO_LLM).
 * Ver wiki [[Auto-tagging]] §Tags semánticos.
 *
 * El paquete `openai` se instala en VPS vía `npm install` del deploy.sh.
 * Local typecheck usa @ts-ignore porque la red local no permite npm install
 * (SSL inspection bloqueante).
 */

// @ts-ignore - resuelto en runtime en VPS tras `npm install`
import OpenAI from "openai";

const MODEL = "gpt-4o-mini";

// Singleton lazy — solo instancia si OPENAI_API_KEY existe y se invoca.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

function getClient() {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no está definido en el entorno");
  }
  _client = new OpenAI({ apiKey });
  return _client;
}

// ─── Tipos del request/response ─────────────────────────────────────

export type LlmConfidence = "high" | "medium" | "low";

export interface LlmTagResult {
  inferredTags: string[];
  confidence:   LlmConfidence;
}

interface LlmMessageInput {
  direction: "INBOUND" | "OUTBOUND";
  body:      string;
}

interface TagCatalogEntry {
  name:        string;
  description: string | null;
}

// ─── Prompt builders ────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un clasificador de conversaciones de un restaurante italiano en México.
Tu tarea: leer una conversación de WhatsApp entre el restaurante y un cliente,
e inferir qué etiquetas del catálogo le aplican al cliente.

REGLAS:
- Solo elige etiquetas que aparezcan en el catálogo provisto.
- Solo aplica una etiqueta si tienes evidencia textual clara. Ante duda, no la apliques.
- "Vegano" / "Vegetariano" / "Sin gluten" solo si el cliente expresa la preferencia
  para sí mismo, NO para terceros ("mi hermana es vegana" NO aplica).
- "Cumpleañero" requiere mención explícita de SU propio cumpleaños en el mes actual.
- Devuelve un array vacío si ninguna aplica.`;

function buildUserPrompt(args: {
  catalog:  TagCatalogEntry[];
  messages: LlmMessageInput[];
}): string {
  const catalogLines = args.catalog
    .map((t) => `- ${t.name}: ${t.description ?? "(sin descripción)"}`)
    .join("\n");
  const messageLines = args.messages
    .map((m) => `[${m.direction}] ${m.body}`)
    .join("\n");

  return `Catálogo de etiquetas activas:
${catalogLines}

Conversación (últimos 7 días, max 30 mensajes):
${messageLines}

Devuelve JSON: { inferredTags: string[], confidence: "high"|"medium"|"low" }`;
}

// ─── Structured Output schema ───────────────────────────────────────

function buildResponseSchema(allowedTagNames: string[]) {
  return {
    type: "json_schema" as const,
    json_schema: {
      name:   "tag_classification",
      strict: true,
      schema: {
        type: "object",
        properties: {
          inferredTags: {
            type:  "array",
            items: { type: "string", enum: allowedTagNames },
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
        },
        required: ["inferredTags", "confidence"],
        additionalProperties: false,
      },
    },
  };
}

// ─── Clasificación de una conversación ──────────────────────────────

/**
 * Clasifica una conversación contra el catálogo. Devuelve los tags inferidos
 * + nivel de confianza. El caller decide si aplicar (la spec dice: solo si
 * confidence === "high" en la v1).
 *
 * Lanza si OpenAI falla — el caller debe atrapar y aislar el error de la
 * conversación específica sin abortar el job completo.
 */
export async function classifyConversation(args: {
  catalog:  TagCatalogEntry[];
  messages: LlmMessageInput[];
}): Promise<LlmTagResult> {
  if (args.catalog.length === 0) {
    return { inferredTags: [], confidence: "high" };
  }
  if (args.messages.length === 0) {
    return { inferredTags: [], confidence: "high" };
  }

  const client       = getClient();
  const allowedNames = args.catalog.map((t) => t.name);

  const completion = await client.chat.completions.create({
    model:    MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: buildUserPrompt(args) },
    ],
    response_format: buildResponseSchema(allowedNames),
    temperature: 0,
  });

  const raw = completion.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error("OpenAI returned empty content");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`OpenAI returned invalid JSON: ${(e as Error).message}`);
  }

  // Validación defensiva del shape, aunque Structured Outputs lo garantiza.
  const p = parsed as Partial<LlmTagResult>;
  if (!Array.isArray(p.inferredTags) || !p.confidence) {
    throw new Error("OpenAI response missing inferredTags or confidence");
  }
  // Filtra strings huérfanos por si el modelo se salta el schema (defensa en
  // profundidad — no debería pasar con strict: true).
  const validNames = new Set(allowedNames);
  const cleaned = p.inferredTags.filter(
    (t): t is string => typeof t === "string" && validNames.has(t),
  );

  return {
    inferredTags: cleaned,
    confidence:   p.confidence,
  };
}

// Exportado para testing del prompt sin gastar API tokens.
export const __internals = { buildUserPrompt, SYSTEM_PROMPT, MODEL };
