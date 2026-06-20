import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-server";
import { normalizeTagName } from "@/lib/tags";

/**
 * GET /api/crm/whatsapp/conversations
 *
 * Query opcionales (ver [[Conversation Tags]] §Modificaciones a endpoints):
 *   - tag=<tagId>       filtra conversaciones con ese tag (activo).
 *   - tagName=<name>    idem, por nombre normalizado.
 *
 * Cada row del response incluye `tags: { id, name, color }[]` — sólo tags
 * activos. El consumer (inbox list) los renderiza con TagPill.
 */
export async function GET(req: NextRequest) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const tagId   = req.nextUrl.searchParams.get("tag");
  const tagName = req.nextUrl.searchParams.get("tagName");

  const where: Prisma.WhatsAppConversationWhereInput = {};
  if (tagId) {
    where.tags = { some: { tagId, tag: { isActive: true } } };
  } else if (tagName) {
    const normalized = normalizeTagName(tagName);
    if (normalized) {
      where.tags = {
        some: { tag: { name: { equals: normalized, mode: "insensitive" }, isActive: true } },
      };
    }
  }

  const conversations = await prisma.whatsAppConversation.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, name: true } },
      messages: {
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { body: true, direction: true, sentAt: true, deletedAt: true, plataforma: true },
      },
      tags: {
        where:   { tag: { isActive: true } },
        include: { tag: { select: { id: true, name: true, color: true } } },
        orderBy: { tag: { name: "asc" } },
      },
      _count: { select: { messages: true } },
    },
  });

  const data = conversations.map((c) => ({
    id:           c.id,
    phone:        c.phone,
    userId:       c.userId,
    userName:     c.user?.name ?? null,
    lastMessage:  c.messages[0] ?? null,
    messageCount: c._count.messages,
    // Cada tag incluye su `source` para que el inbox pinte el badge
    // (👤 MANUAL · ⚙️ AUTO_RULE · 🤖 AUTO_LLM).
    tags:         c.tags.map((t) => ({ ...t.tag, source: t.source })),
    updatedAt:    c.updatedAt,
  }));

  return NextResponse.json({ data, total: data.length });
}
