import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { requireAdmin } from "@/lib/auth-server";
import { TAG_COLORS } from "@/lib/tagColors";
import { normalizeTagName, findTagByName } from "@/lib/tags";
import type { ApiResponse } from "@/types";

/**
 * Update / soft-delete de un tag del catálogo. ADMIN-only.
 * Ver [[Conversation Tags]] §PATCH §DELETE.
 */

const patchSchema = z.object({
  name:        z.string().min(1).max(60).optional(),
  color:       z.enum(TAG_COLORS).optional(),
  description: z.string().max(300).nullable().optional(),
  isActive:    z.boolean().optional(),
});

/**
 * PATCH /api/crm/tags/[id]
 * Partial update. 404 si no existe; 409 si rename colisiona con otro tag.
 */
export async function PATCH(
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const data: Prisma.TagUpdateInput = {};
  if (parsed.data.name !== undefined) {
    const normalized = normalizeTagName(parsed.data.name);
    if (!normalized) return NextResponse.json<ApiResponse>(
      { success: false, error: "empty_name" }, { status: 400 },
    );
    data.name = normalized;
  }
  if (parsed.data.color       !== undefined) data.color       = parsed.data.color;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.isActive    !== undefined) data.isActive    = parsed.data.isActive;

  return runWithSession(s, () =>
    withApp(async (db) => {
      // Si se renombra, validar colisión case-insensitive contra OTRO tag.
      if (typeof data.name === "string") {
        const conflict = await findTagByName(db, data.name);
        if (conflict && conflict.id !== params.id) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: "name_already_exists" }, { status: 409 },
          );
        }
      }
      try {
        const tag = await db.tag.update({ where: { id: params.id }, data });
        return NextResponse.json<ApiResponse>({ success: true, data: { tag } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
          if (e.code === "P2025") {
            return NextResponse.json<ApiResponse>(
              { success: false, error: "not_found" }, { status: 404 },
            );
          }
          if (e.code === "P2002") {
            return NextResponse.json<ApiResponse>(
              { success: false, error: "name_already_exists" }, { status: 409 },
            );
          }
        }
        console.error("[CRM tags PATCH]", e);
        return NextResponse.json<ApiResponse>(
          { success: false, error: "update_failed" }, { status: 500 },
        );
      }
    }),
  );
}

/**
 * DELETE /api/crm/tags/[id]
 * Soft delete: marca isActive=false. NO borra el tag ni los joins
 * ConversationTag (auditoría histórica). Para hard delete usar Prisma Studio.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json<ApiResponse>(
    { success: false, error: "forbidden" }, { status: 403 },
  );

  return runWithSession(s, () =>
    withApp(async (db) => {
      try {
        const tag = await db.tag.update({
          where:  { id: params.id },
          data:   { isActive: false },
          select: { id: true, isActive: true },
        });
        return NextResponse.json<ApiResponse>({ success: true, data: tag });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
          return NextResponse.json<ApiResponse>(
            { success: false, error: "not_found" }, { status: 404 },
          );
        }
        console.error("[CRM tags DELETE]", e);
        return NextResponse.json<ApiResponse>(
          { success: false, error: "delete_failed" }, { status: 500 },
        );
      }
    }),
  );
}
