import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import type { ApiResponse } from "@/types";

const CAT_SELECT = { id: true, name: true, position: true, visible: true, cartaId: true } as const;

/** PATCH /api/admin/menu/categories/:id — renombra / ordena / oculta / mueve de carta. ADMIN. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : undefined;
  if (name !== undefined && !name) return NextResponse.json<ApiResponse>({ success: false, error: "Ponle nombre a la categoría" }, { status: 400 });
  const position = Number.isInteger(body?.position) ? (body.position as number) : undefined;
  const visible = typeof body?.visible === "boolean" ? (body.visible as boolean) : undefined;
  const cartaId = typeof body?.cartaId === "string" && body.cartaId ? body.cartaId : undefined;
  if (name === undefined && position === undefined && visible === undefined && cartaId === undefined) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Sin cambios" }, { status: 400 });
  }

  const exists = await prisma.menuCategory.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json<ApiResponse>({ success: false, error: "Categoría no encontrada" }, { status: 404 });
  if (cartaId) {
    const c = await prisma.carta.findUnique({ where: { id: cartaId }, select: { id: true } });
    if (!c) return NextResponse.json<ApiResponse>({ success: false, error: "Carta destino no encontrada" }, { status: 404 });
  }

  const updated = await prisma.menuCategory.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(position !== undefined ? { position } : {}),
      ...(visible !== undefined ? { visible } : {}),
      ...(cartaId !== undefined ? { cartaId } : {}),
    },
    select: CAT_SELECT,
  });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}

/** DELETE /api/admin/menu/categories/:id — elimina una categoría VACÍA (sin platillos). ADMIN. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const count = await prisma.dish.count({ where: { categoryId: params.id } });
  if (count > 0) return NextResponse.json<ApiResponse>({ success: false, error: "La categoría tiene platillos; muévelos o deshabilítalos primero" }, { status: 409 });

  await prisma.menuCategory.delete({ where: { id: params.id } });
  return NextResponse.json<ApiResponse>({ success: true, data: { id: params.id } });
}
