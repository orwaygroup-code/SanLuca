import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { requireAdmin } from "@/lib/auth-server";
import { TAG_COLORS } from "@/lib/tagColors";
import { normalizeTagName } from "@/lib/tags";
import type { ApiResponse } from "@/types";

/**
 * Tags aplicados a una conversación específica. ADMIN-only.
 * Ver [[Conversation Tags]] §Tags por conversación.
 */

// Discriminated union: el body puede traer `tagId` (asignar existente) o
// `name` (upsert por nombre + asignar). Mutuamente excluyentes.
const applyByIdSchema = z.object({
  tagId: z.string().min(1),
});
const applyByNameSchema = z.object({
  name:  z.string().min(1).max(60),
  color: z.enum(TAG_COLORS).optional(),
});

/** Resuelve la conversación por phone. 404 si no existe. */
async function findConversation(
  db: Prisma.TransactionClient,
  phoneRaw: string,
): Promise<{ id: string } | null> {
  const phone = decodeURIComponent(phoneRaw);
  return db.whatsAppConversation.findUnique({
    where:  { phone },
    select: { id: true },
  });
}

/**
 * GET /api/crm/whatsapp/conversations/[phone]/tags
 * Devuelve los tags activos aplicados a esa conversación.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { phone: string } },
) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json<ApiResponse>(
    { success: false, error: "forbidden" }, { status: 403 },
  );

  return runWithSession(s, () =>
    withApp(async (db) => {
      const conv = await findConversation(db, params.phone);
      if (!conv) return NextResponse.json<ApiResponse>(
        { success: false, error: "conversation_not_found" }, { status: 404 },
      );

      // LEFT JOIN implícito + filter por tag.isActive.
      const rows = await db.conversationTag.findMany({
        where:   { conversationId: conv.id, tag: { isActive: true } },
        include: { tag: true },
        orderBy: { tag: { name: "asc" } },
      });
      const tags = rows.map((r) => r.tag);
      return NextResponse.json<ApiResponse>({ success: true, data: { tags } });
    }),
  );
}

/**
 * POST /api/crm/whatsapp/conversations/[phone]/tags
 *   body: { tagId } | { name, color? }
 *
 * Si llega tagId → 404 si no existe o isActive=false.
 * Si llega name → upsert por nombre normalizado, luego aplica.
 * 409 si ya estaba aplicado a esa conversación.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { phone: string } },
) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json<ApiResponse>(
    { success: false, error: "forbidden" }, { status: 403 },
  );

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "invalid_body" }, { status: 400 },
    );
  }

  // Body discriminado: { tagId } | { name, color? }. Probamos id primero;
  // si falla, intentamos name. Si ambos fallan, 400.
  type Payload =
    | { kind: "id";   tagId: string }
    | { kind: "name"; name:  string; color?: typeof TAG_COLORS[number] };

  let payload: Payload | null = null;
  const byId = applyByIdSchema.safeParse(body);
  if (byId.success) {
    payload = { kind: "id", tagId: byId.data.tagId };
  } else {
    const byName = applyByNameSchema.safeParse(body);
    if (byName.success) {
      payload = { kind: "name", name: byName.data.name, color: byName.data.color };
    }
  }
  if (!payload) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "body must include { tagId } or { name, color? }" },
      { status: 400 },
    );
  }

  return runWithSession(s, () =>
    withApp(async (db) => {
      const conv = await findConversation(db, params.phone);
      if (!conv) return NextResponse.json<ApiResponse>(
        { success: false, error: "conversation_not_found" }, { status: 404 },
      );

      // Resolver tag: by id (debe existir y estar activo) o por name (upsert).
      let tag: { id: string; name: string; color: string; description: string | null; isActive: boolean; createdAt: Date; updatedAt: Date };
      if (payload.kind === "id") {
        const existing = await db.tag.findUnique({ where: { id: payload.tagId } });
        if (!existing || !existing.isActive) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: "tag_not_found_or_inactive" }, { status: 404 },
          );
        }
        tag = existing;
      } else {
        const name = normalizeTagName(payload.name);
        if (!name) return NextResponse.json<ApiResponse>(
          { success: false, error: "empty_name" }, { status: 400 },
        );
        // upsert por name (unique). Si existe pero isActive=false, lo reactiva
        // implícitamente al usarlo — decisión deliberada: el admin "creando"
        // un tag que ya fue desactivado debería resucitarlo.
        // VERIFY ON DEPLOY: confirmar UX en /crm/tags — un admin podría
        // sorprenderse de que un tag "borrado" reaparezca al ser usado.
        tag = await db.tag.upsert({
          where:  { name },
          update: { isActive: true },
          create: {
            name,
            color: payload.color ?? "slate",
          },
        });
      }

      // Aplicar el join. P2002 si ya estaba aplicado.
      try {
        const conversationTag = await db.conversationTag.create({
          data: {
            conversationId: conv.id,
            tagId:          tag.id,
            appliedById:    s.userId,
          },
        });
        return NextResponse.json<ApiResponse>(
          { success: true, data: { tag, conversationTag } }, { status: 201 },
        );
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return NextResponse.json<ApiResponse>(
            { success: false, error: "tag_already_applied" }, { status: 409 },
          );
        }
        console.error("[CRM conv tags POST]", e);
        return NextResponse.json<ApiResponse>(
          { success: false, error: "apply_failed" }, { status: 500 },
        );
      }
    }),
  );
}
