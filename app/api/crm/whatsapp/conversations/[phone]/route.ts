import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-server";

export async function GET(
  req: NextRequest,
  { params }: { params: { phone: string } }
) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const phone = decodeURIComponent(params.phone);

  const conversation = await prisma.whatsAppConversation.findUnique({
    where: { phone },
    include: {
      user: { select: { id: true, name: true, phone: true } },
      messages: {
        orderBy: { sentAt: "asc" },
        select: { id: true, direction: true, body: true, messageType: true, sentAt: true },
      },
      // Tags activos aplicados a la conversación — sirven al
      // ConversationTagsEditor del thread abierto.
      tags: {
        where:   { tag: { isActive: true } },
        include: { tag: true },
        orderBy: { tag: { name: "asc" } },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Planchamos `tags` para que el cliente reciba `Tag[]` directo en vez
  // del envoltorio ConversationTag — más cómodo para TagPill.
  const { tags, ...rest } = conversation;
  return NextResponse.json({
    conversation: {
      ...rest,
      tags: tags.map((t) => t.tag),
    },
  });
}
