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
 * Tags aplicados a un usuario específico. ADMIN-only.
 * Ver wiki [[Auto-tagging]] §API nueva.
 *
 * Análogo al CRUD por conversación pero contra `User`. Source default
 * MANUAL para todo lo aplicado por humanos desde la UI; AUTO_RULE lo
 * pone el cron y AUTO_LLM lo pone el LLM (este endpoint no expone esos
 * sources, los marca como MANUAL al venir del admin).
 */

const applyByIdSchema = z.object({
  tagId: z.string().min(1),
});
const applyByNameSchema = z.object({
  name:  z.string().min(1).max(60),
  color: z.enum(TAG_COLORS).optional(),
});

async function findUser(
  db: Prisma.TransactionClient,
  userId: string,
): Promise<{ id: string } | null> {
  return db.user.findUnique({ where: { id: userId }, select: { id: true } });
}

/**
 * GET /api/crm/users/[id]/tags
 * Devuelve los tags activos del usuario (incluye source para badges UI).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json<ApiResponse>(
    { success: false, error: "forbidden" }, { status: 403 },
  );

  return runWithSession(s, () =>
    withApp(async (db) => {
      const user = await findUser(db, params.id);
      if (!user) return NextResponse.json<ApiResponse>(
        { success: false, error: "user_not_found" }, { status: 404 },
      );

      const rows = await db.userTag.findMany({
        where:   { userId: user.id, tag: { isActive: true } },
        include: { tag: true },
        orderBy: { tag: { name: "asc" } },
      });
      // Devolver el tag enriquecido con source/appliedAt/appliedById para
      // que la UI pueda renderizar el badge y el botón "Fijar".
      const tags = rows.map((r) => ({
        ...r.tag,
        source:      r.source,
        appliedAt:   r.appliedAt,
        appliedById: r.appliedById,
        userTagId:   r.id,
      }));
      return NextResponse.json<ApiResponse>({ success: true, data: { tags } });
    }),
  );
}

/**
 * POST /api/crm/users/[id]/tags
 *   body: { tagId } | { name, color? }
 *
 * Aplica con source=MANUAL y appliedById=session.userId.
 * 409 si ya está aplicado.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
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
      const user = await findUser(db, params.id);
      if (!user) return NextResponse.json<ApiResponse>(
        { success: false, error: "user_not_found" }, { status: 404 },
      );

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
        tag = await db.tag.upsert({
          where:  { name },
          update: { isActive: true },
          create: { name, color: payload.color ?? "slate" },
        });
      }

      try {
        const userTag = await db.userTag.create({
          data: {
            userId:      user.id,
            tagId:       tag.id,
            source:      "MANUAL",
            appliedById: s.userId,
          },
        });
        return NextResponse.json<ApiResponse>(
          { success: true, data: { tag, userTag } }, { status: 201 },
        );
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return NextResponse.json<ApiResponse>(
            { success: false, error: "tag_already_applied" }, { status: 409 },
          );
        }
        console.error("[CRM user tags POST]", e);
        return NextResponse.json<ApiResponse>(
          { success: false, error: "apply_failed" }, { status: 500 },
        );
      }
    }),
  );
}
