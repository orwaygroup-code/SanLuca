import { prisma } from "@/lib/prisma";
import { RULES } from "@/lib/tagRules";
import { classifyConversation } from "@/lib/openaiClient";

/**
 * Cron job de auto-tagging. Ver wiki [[Auto-tagging]] §Cron job.
 *
 * Dos pases secuenciales:
 *   1. Rules pass — deterministas sobre el catálogo de tags conocidos.
 *      Loop INVERTIDO (Plan agent): 1 query agregada por regla → diff de
 *      sets contra UserTag existentes → bulk INSERT/DELETE. 12 queries
 *      totales para N usuarios × 4 reglas.
 *   2. LLM pass — gpt-4o-mini sobre conversaciones activas (≥5 mensajes,
 *      updatedAt < 7d). Concurrencia pool=5 con helper casero.
 *
 * Idempotente. MANUAL siempre wins. Errores aislados por unidad de trabajo.
 */

const LLM_CONCURRENCY        = 5;
const LLM_MIN_MESSAGES       = 5;
const LLM_MAX_MESSAGES       = 30;
const LLM_RECENT_DAYS        = 7;
const LLM_ERRORS_TRUNCATE    = 50;
const LLM_REQUIRED_CONFIDENCE = "high" as const;

// Tags semánticos elegibles para AUTO_LLM. Otros (VIP, Inactivo) los maneja
// el rules pass — incluirlos aquí sería ruido para el LLM. Ver spec §LLM.
const LLM_ELIGIBLE_TAG_NAMES = new Set([
  "Vegano",
  "Vegetariano",
  "Sin gluten",
  "Mariscos",
  "Pareja",
  "Negocios",
  "Cumpleañero",
  "Grupo grande",
]);

// ─── Tipos del resultado ────────────────────────────────────────────

export interface AutoTagJobResult {
  startedAt:   Date;
  finishedAt:  Date;
  rules: {
    perRule: Array<{ tagName: string; matched: number; hadTag: number; added: number; removed: number; skipped?: string }>;
    appliedTotal: number;
    removedTotal: number;
  };
  llm: {
    conversationsConsidered: number;
    conversationsSkipped:    number;
    appliedTotal:            number;
    errors:                  Array<{ conversationId: string; phase: string; message: string }>;
  };
}

// ─── Helper: pool de concurrencia ───────────────────────────────────

async function mapWithConcurrency<T, R>(
  items: T[],
  poolSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(poolSize, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ─── Snapshot del catálogo (al inicio del run) ──────────────────────

interface TagSnapshot {
  byName: Map<string, { id: string; name: string; description: string | null }>;
}

async function loadCatalogSnapshot(): Promise<TagSnapshot> {
  // Solo isActive=true. Tags desactivados a mitad del run no afectan
  // decisiones tomadas en este pase (consistencia transaccional débil).
  const tags = await prisma.tag.findMany({
    where:  { isActive: true },
    select: { id: true, name: true, description: true },
  });
  const byName = new Map<string, { id: string; name: string; description: string | null }>();
  for (const t of tags) byName.set(t.name, t);
  return { byName };
}

// ─── Rules pass ─────────────────────────────────────────────────────

async function runRulesPass(
  snapshot: TagSnapshot,
): Promise<AutoTagJobResult["rules"]> {
  const perRule: AutoTagJobResult["rules"]["perRule"] = [];
  let appliedTotal = 0;
  let removedTotal = 0;

  console.log("[AUTO_TAG] rules pass started");

  for (const rule of RULES) {
    const tag = snapshot.byName.get(rule.tagName);
    if (!tag) {
      // Tag no existe o está inactivo en catálogo → no aplicar ni limpiar.
      // Respeta el catálogo del admin sin tocar trabajo MANUAL preexistente.
      perRule.push({ tagName: rule.tagName, matched: 0, hadTag: 0, added: 0, removed: 0, skipped: "tag_inactive_or_missing" });
      continue;
    }

    // 1. Quién matchea la regla (set).
    const matched = await rule.findMatchingUserIds(prisma);

    // 2. Quién ya tiene el UserTag (cualquier source).
    const existingRows = await prisma.userTag.findMany({
      where:  { tagId: tag.id },
      select: { userId: true, source: true },
    });
    const existingAny = new Set(existingRows.map((r) => r.userId));
    const existingAutoRule = new Set(
      existingRows.filter((r) => r.source === "AUTO_RULE").map((r) => r.userId),
    );

    // 3. Diffs:
    //    toAdd    = matched ∧ ¬existingAny      → INSERT AUTO_RULE
    //    toRemove = ¬matched ∧ existingAutoRule → DELETE (solo AUTO_RULE)
    const toAdd:    string[] = [];
    const toRemove: string[] = [];
    for (const userId of matched) {
      if (!existingAny.has(userId)) toAdd.push(userId);
    }
    for (const userId of existingAutoRule) {
      if (!matched.has(userId)) toRemove.push(userId);
    }

    // 4. Bulk INSERT (createMany con skipDuplicates por seguridad).
    if (toAdd.length > 0) {
      const created = await prisma.userTag.createMany({
        data: toAdd.map((userId) => ({
          userId,
          tagId:       tag.id,
          source:      "AUTO_RULE" as const,
          appliedById: "system:cron-rules",
        })),
        skipDuplicates: true,
      });
      appliedTotal += created.count;
      for (const uid of toAdd) {
        console.log(`[AUTO_TAG] applied AUTO_RULE "${rule.tagName}" to user ${uid}`);
      }
    }

    // 5. Bulk DELETE (filtro source=AUTO_RULE safe ante concurrencia).
    if (toRemove.length > 0) {
      const removed = await prisma.userTag.deleteMany({
        where: { tagId: tag.id, userId: { in: toRemove }, source: "AUTO_RULE" },
      });
      removedTotal += removed.count;
      for (const uid of toRemove) {
        console.log(`[AUTO_TAG] removed AUTO_RULE "${rule.tagName}" from user ${uid}`);
      }
    }

    perRule.push({
      tagName: rule.tagName,
      matched: matched.size,
      hadTag:  existingAny.size,
      added:   toAdd.length,
      removed: toRemove.length,
    });
  }

  console.log(`[AUTO_TAG] rules pass complete: applied=${appliedTotal} removed=${removedTotal}`);
  return { perRule, appliedTotal, removedTotal };
}

// ─── LLM pass ───────────────────────────────────────────────────────

async function runLlmPass(
  snapshot: TagSnapshot,
): Promise<AutoTagJobResult["llm"]> {
  // Catálogo elegible para LLM = intersección (snapshot ∩ LLM_ELIGIBLE).
  const eligibleCatalog = Array.from(snapshot.byName.values()).filter((t) =>
    LLM_ELIGIBLE_TAG_NAMES.has(t.name),
  );
  if (eligibleCatalog.length === 0) {
    console.log("[AUTO_TAG] llm pass skipped: no eligible tags in active catalog");
    return { conversationsConsidered: 0, conversationsSkipped: 0, appliedTotal: 0, errors: [] };
  }

  // Conversaciones candidatas: ≥LLM_MIN_MESSAGES, updatedAt en últimos LLM_RECENT_DAYS.
  const cutoff = new Date(Date.now() - LLM_RECENT_DAYS * 86400000);
  const candidates = await prisma.whatsAppConversation.findMany({
    where: {
      updatedAt: { gt: cutoff },
      messages:  { some: {} },
    },
    select: {
      id: true,
      _count: { select: { messages: true } },
    },
  });
  const eligible = candidates.filter((c) => c._count.messages >= LLM_MIN_MESSAGES);

  console.log(`[AUTO_TAG] llm pass started: candidates=${candidates.length} eligible=${eligible.length}`);

  const errors: AutoTagJobResult["llm"]["errors"] = [];
  let appliedTotal = 0;

  const results = await mapWithConcurrency(eligible, LLM_CONCURRENCY, async (conv) => {
    try {
      const messages = await prisma.whatsAppMessage.findMany({
        where:   { conversationId: conv.id },
        orderBy: { sentAt: "desc" },
        take:    LLM_MAX_MESSAGES,
        select:  { direction: true, body: true },
      });
      // Re-ordenar cronológicamente para enviar al LLM en orden de lectura.
      messages.reverse();

      const result = await classifyConversation({
        catalog:  eligibleCatalog.map((t) => ({ name: t.name, description: t.description })),
        messages,
      });

      // Solo aplicar si confidence === LLM_REQUIRED_CONFIDENCE.
      if (result.confidence !== LLM_REQUIRED_CONFIDENCE) return { applied: 0 };
      if (result.inferredTags.length === 0)               return { applied: 0 };

      let applied = 0;
      for (const tagName of result.inferredTags) {
        const tag = snapshot.byName.get(tagName);
        if (!tag) continue; // tag desactivado a mitad de run
        try {
          await prisma.conversationTag.create({
            data: {
              conversationId: conv.id,
              tagId:          tag.id,
              source:         "AUTO_LLM",
              appliedById:    "system:llm",
            },
          });
          applied += 1;
          console.log(`[AUTO_TAG] inferred "${tagName}" (high) for conversation ${conv.id}`);
        } catch (e) {
          // P2002 = ya estaba aplicado (manual o auto previo). Idempotente OK.
          const code = (e as { code?: string }).code;
          if (code !== "P2002") {
            errors.push({
              conversationId: conv.id, phase: "prisma",
              message: `${code ?? "?"}: ${(e as Error).message}`,
            });
          }
        }
      }
      return { applied };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ conversationId: conv.id, phase: "openai", message: msg });
      console.error(`[AUTO_TAG] openai error for conversation ${conv.id}: ${msg}`);
      return { applied: 0 };
    }
  });

  for (const r of results) appliedTotal += r.applied;

  const skipped = candidates.length - eligible.length;
  console.log(`[AUTO_TAG] llm pass complete: applied=${appliedTotal} errors=${errors.length} skipped=${skipped}`);

  return {
    conversationsConsidered: eligible.length,
    conversationsSkipped:    skipped,
    appliedTotal,
    errors: errors.slice(0, LLM_ERRORS_TRUNCATE),
  };
}

// ─── Orquestador principal ──────────────────────────────────────────

export async function runAutoTagJob(): Promise<AutoTagJobResult> {
  const startedAt = new Date();
  console.log(`[AUTO_TAG] job started at ${startedAt.toISOString()}`);

  const snapshot = await loadCatalogSnapshot();

  const rules = await runRulesPass(snapshot);
  const llm   = await runLlmPass(snapshot);

  const finishedAt = new Date();
  console.log(`[AUTO_TAG] job finished at ${finishedAt.toISOString()} (took ${finishedAt.getTime() - startedAt.getTime()}ms)`);

  return { startedAt, finishedAt, rules, llm };
}
