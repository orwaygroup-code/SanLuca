import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { requireAdmin } from "@/lib/auth-server";
import type { ApiResponse } from "@/types";

/**
 * DELETE /api/crm/whatsapp/conversations/[phone]/tags/[tagId]
 *
 * Quita la asignación. Borra el row `ConversationTag` (hard delete del join,
 * NO del tag — el tag sigue existiendo para otras conversaciones).
 *
 * Idempotente: si la asignación no existía, devuelve 200 igualmente para
 * que el UI no tenga que distinguir "no estaba" vs "se quitó".
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { phone: string; tagId: string } },
) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json<ApiResponse>(
    { success: false, error: "forbidden" }, { status: 403 },
  );

  const phone = decodeURIComponent(params.phone);

  return runWithSession(s, () =>
    withApp(async (db) => {
      const conv = await db.whatsAppConversation.findUnique({
        where:  { phone },
        select: { id: true },
      });
      if (!conv) return NextResponse.json<ApiResponse>(
        { success: false, error: "conversation_not_found" }, { status: 404 },
      );

      try {
        await db.conversationTag.delete({
          where: { conversationId_tagId: { conversationId: conv.id, tagId: params.tagId } },
        });
      } catch (e) {
        // P2025 = row no encontrado. Idempotente — tratamos como éxito.
        if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2025") {
          console.error("[CRM conv tags DELETE]", e);
          return NextResponse.json<ApiResponse>(
            { success: false, error: "delete_failed" }, { status: 500 },
          );
        }
      }
      return NextResponse.json<ApiResponse>({ success: true });
    }),
  );
}
