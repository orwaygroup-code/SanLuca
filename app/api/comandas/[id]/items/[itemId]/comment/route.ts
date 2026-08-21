import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActor, isSupervisor } from "@/lib/dualAuth";
import { TENANT, COMANDA_INCLUDE } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const MAX_LEN = 500;

/**
 * Comentarios por producto:
 * - POST: agrega un comentario nuevo.
 * - PATCH { commentId, text }: edita un comentario existente (solo su autor o un supervisor),
 *   para no acumular listas largas — el mesero corrige el suyo en vez de agregar otro.
 * Permitido mientras la comanda está activa o por cobrar (no PAID/CANCELLED/MERGED). Agregar lo
 * puede el mesero dueño, quien abrió la cuenta, cualquier rol de caja o un supervisor.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const id = parseId(params.id);
  const itemId = parseId(params.itemId);
  if (!id || !itemId) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json<ApiResponse>({ success: false, error: "El comentario no puede estar vacío" }, { status: 400 });
  if (text.length > MAX_LEN) return NextResponse.json<ApiResponse>({ success: false, error: `Máximo ${MAX_LEN} caracteres` }, { status: 400 });

  const item = await prisma.comandaItem.findFirst({
    where: { id: itemId, comandaId: id, tenantId: TENANT },
    include: { comanda: { select: { waiterId: true, openedById: true, status: true } } },
  });
  if (!item) return NextResponse.json<ApiResponse>({ success: false, error: "Item no encontrado" }, { status: 404 });

  // No se comenta una cuenta ya sellada/anulada.
  if (["PAID", "CANCELLED", "MERGED"].includes(item.comanda.status)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "La cuenta ya está cerrada; no admite comentarios" }, { status: 409 });
  }

  const isStaff = actor.realm === "staff";
  const isCajaRole = isStaff && (actor.role === "OPERATION" || actor.role === "CAPTAIN" || actor.role === "MANAGER");
  const isOwnerWaiter = isStaff && actor.role === "WAITER" && item.comanda.waiterId === actor.staffId;
  const isOpener = isStaff && item.comanda.openedById === actor.staffId;
  if (!(isSupervisor(actor) || isCajaRole || isOwnerWaiter || isOpener)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado para comentar esta cuenta" }, { status: 403 });
  }

  await prisma.comandaItemComment.create({
    data: {
      tenantId: TENANT,
      itemId,
      text,
      createdById: isStaff ? actor.staffId : null,
    },
  });

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}

/** PATCH /api/comandas/:id/items/:itemId/comment { commentId, text } — edita un comentario. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const id = parseId(params.id);
  const itemId = parseId(params.itemId);
  if (!id || !itemId) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const commentId = Number.isInteger(body?.commentId) ? (body.commentId as number) : null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!commentId) return NextResponse.json<ApiResponse>({ success: false, error: "commentId requerido" }, { status: 400 });
  if (!text) return NextResponse.json<ApiResponse>({ success: false, error: "El comentario no puede estar vacío" }, { status: 400 });
  if (text.length > MAX_LEN) return NextResponse.json<ApiResponse>({ success: false, error: `Máximo ${MAX_LEN} caracteres` }, { status: 400 });

  const comment = await prisma.comandaItemComment.findFirst({
    where: { id: commentId, itemId, tenantId: TENANT, item: { comandaId: id } },
    select: { id: true, createdById: true, item: { select: { comanda: { select: { status: true } } } } },
  });
  if (!comment) return NextResponse.json<ApiResponse>({ success: false, error: "Comentario no encontrado" }, { status: 404 });
  if (["PAID", "CANCELLED", "MERGED"].includes(comment.item.comanda.status)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "La cuenta ya está cerrada; no admite cambios" }, { status: 409 });
  }

  // Solo el autor del comentario o un supervisor puede editarlo.
  const isAuthor = actor.realm === "staff" && comment.createdById != null && comment.createdById === actor.staffId;
  if (!(isAuthor || isSupervisor(actor))) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Solo el autor o un supervisor puede editar el comentario" }, { status: 403 });
  }

  await prisma.comandaItemComment.update({ where: { id: commentId }, data: { text } });

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
