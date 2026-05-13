import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const conversations = await prisma.whatsAppConversation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true } },
      messages: {
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { body: true, direction: true, sentAt: true },
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
    updatedAt:    c.updatedAt,
  }));

  return NextResponse.json({ data, total: data.length });
}
