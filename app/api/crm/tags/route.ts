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
 * Catálogo global de tags. ADMIN-only — auth conventions en [[Auth API]].
 * Ver wiki [[Conversation Tags]] §API §Catálogo de tags.
 */

const colorSchema = z.enum(TAG_COLORS);

const createSchema = z.object({
  name:        z.string().min(1).max(60),
  color:       colorSchema.optional(),
  description: z.string().max(300).optional(),
});

/**
 * GET /api/crm/tags?includeInactive=1
 * Por defecto sólo devuelve tags activos.
 */
export async function GET(req: NextRequest) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json<ApiResponse>(
    { success: false, error: "forbidden" }, { status: 403 },
  );

  // VERIFY ON DEPLOY: las tablas Tag y ConversationTag son nuevas — RLS
  // policies sobre prisma/sql/ probablemente no las cubren todavía. Si el
  // rol sanluca_app no tiene grants, GET/POST/PATCH/DELETE fallarán con 500.
  // Fix rápido si pasa: usar `prisma` admin client en lugar de `withApp()`,
  // o añadir policies para los modelos nuevos.
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  // Filtro por source: devuelve solo tags que tienen al menos una asignación
  // (en UserTag o ConversationTag) con ese source. Útil para auditar de dónde
  // vienen los tags. Ver [[Auto-tagging]] §UI §Filtro por source.
  const sourceParam = req.nextUrl.searchParams.get("source")?.toUpperCase();
  const sourceFilter = ["MANUAL", "AUTO_RULE", "AUTO_LLM"].includes(sourceParam ?? "")
    ? (sourceParam as "MANUAL" | "AUTO_RULE" | "AUTO_LLM")
    : null;

  return runWithSession(s, () =>
    withApp(async (db) => {
      const where: import("@prisma/client").Prisma.TagWhereInput = includeInactive ? {} : { isActive: true };
      if (sourceFilter) {
        where.OR = [
          { conversations: { some: { source: sourceFilter } } },
          { users:         { some: { source: sourceFilter } } },
        ];
      }
      const tags = await db.tag.findMany({
        where,
        orderBy: { name: "asc" },
      });
      return NextResponse.json<ApiResponse>({ success: true, data: { tags } });
    }),
  );
}

/**
 * POST /api/crm/tags  body: { name, color?, description? }
 * - 400 si validación falla.
 * - 409 si name colisiona con otro tag (case-insensitive).
 */
export async function POST(req: NextRequest) {
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }
  const name = normalizeTagName(parsed.data.name);
  if (!name) return NextResponse.json<ApiResponse>(
    { success: false, error: "empty_name" }, { status: 400 },
  );

  return runWithSession(s, () =>
    withApp(async (db) => {
      const existing = await findTagByName(db, name);
      if (existing) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: "name_already_exists" }, { status: 409 },
        );
      }
      const tag = await db.tag.create({
        data: {
          name,
          color:       parsed.data.color ?? "slate",
          description: parsed.data.description ?? null,
        },
      });
      return NextResponse.json<ApiResponse>(
        { success: true, data: { tag } }, { status: 201 },
      );
    }),
  ).catch((e) => {
    // VERIFY ON DEPLOY: si RLS bloquea INSERT al rol app, este catch lo
    // expone como 500 — revisar logs del primer POST en VPS para confirmar.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "name_already_exists" }, { status: 409 },
      );
    }
    console.error("[CRM tags POST]", e);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "create_failed" }, { status: 500 },
    );
  });
}
