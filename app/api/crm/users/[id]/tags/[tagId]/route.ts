import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { requireAdmin } from "@/lib/auth-server";
import type { ApiResponse } from "@/types";

/**
 * DELETE: quita la asignación userTag. Idempotente (P2025 → success).
 *
 * PATCH:  cambia el `source` (MANUAL ↔ AUTO_RULE ↔ AUTO_LLM). Sirve para
 * el botón "🔒 Fijar" — promoción de AUTO_* a MANUAL para que el cron no
 * lo limpie. También permite "🔓 Desfijar" volviendo a AUTO_RULE/AUTO_LLM
 * según corresponda.
 */

const patchSchema = z.object({
  source: z.enum(["MANUAL", "AUTO_RULE", "AUTO_LLM"]),
});

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; tagId: string } },
) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json<ApiResponse>(
    { success: false, error: "forbidden" }, { status: 403 },
  );

  return runWithSession(s, () =>
    withApp(async (db) => {
      const user = await db.user.findUnique({
        where:  { id: params.id },
        select: { id: true },
      });
      if (!user) return NextResponse.json<ApiResponse>(
        { success: false, error: "user_not_found" }, { status: 404 },
      );

      try {
        await db.userTag.delete({
          where: { userId_tagId: { userId: user.id, tagId: params.tagId } },
        });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2025") {
          console.error("[CRM user tags DELETE]", e);
          return NextResponse.json<ApiResponse>(
            { success: false, error: "delete_failed" }, { status: 500 },
          );
        }
      }
      return NextResponse.json<ApiResponse>({ success: true });
    }),
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; tagId: string } },
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

  return runWithSession(s, () =>
    withApp(async (db) => {
      try {
        const userTag = await db.userTag.update({
          where: { userId_tagId: { userId: params.id, tagId: params.tagId } },
          data:  {
            source:      parsed.data.source,
            // Si promueve a MANUAL, registrar quién lo hizo (auditoría).
            appliedById: parsed.data.source === "MANUAL" ? s.userId : undefined,
          },
        });
        return NextResponse.json<ApiResponse>({ success: true, data: { userTag } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
          return NextResponse.json<ApiResponse>(
            { success: false, error: "not_found" }, { status: 404 },
          );
        }
        console.error("[CRM user tags PATCH]", e);
        return NextResponse.json<ApiResponse>(
          { success: false, error: "update_failed" }, { status: 500 },
        );
      }
    }),
  );
}
