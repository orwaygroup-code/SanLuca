import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import type { ApiResponse } from "@/types";

const CARTA_SELECT = { id: true, name: true, turno: true, clase: true, position: true, isPrincipal: true } as const;

/** PATCH /api/admin/menu/cartas/:id — renombra/mueve una carta. ADMIN. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : undefined;
  if (name !== undefined && !name) return NextResponse.json<ApiResponse>({ success: false, error: "Ponle nombre a la carta" }, { status: 400 });
  const turno = body?.turno === "COMIDA" || body?.turno === "BRUNCH" ? body.turno : undefined;
  const clase = body?.clase === "COCINA" || body?.clase === "BARRA" ? body.clase : undefined;
  const position = Number.isInteger(body?.position) ? (body.position as number) : undefined;
  const isPrincipal = typeof body?.isPrincipal === "boolean" ? (body.isPrincipal as boolean) : undefined;
  if (name === undefined && turno === undefined && clase === undefined && position === undefined && isPrincipal === undefined) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Sin cambios" }, { status: 400 });
  }

  const carta = await prisma.carta.findUnique({ where: { id: params.id }, select: { id: true, turno: true } });
  if (!carta) return NextResponse.json<ApiResponse>({ success: false, error: "Carta no encontrada" }, { status: 404 });

  const updateData = {
    ...(name !== undefined ? { name } : {}),
    ...(turno !== undefined ? { turno } : {}),
    ...(clase !== undefined ? { clase } : {}),
    ...(position !== undefined ? { position } : {}),
    ...(isPrincipal !== undefined ? { isPrincipal } : {}),
  };

  try {
    await prisma.$transaction([
      // Solo puede haber UNA carta principal por turno: al marcar ésta, desmarca las demás.
      ...(isPrincipal === true ? [prisma.carta.updateMany({ where: { turno: turno ?? carta.turno, id: { not: params.id } }, data: { isPrincipal: false } })] : []),
      prisma.carta.update({ where: { id: params.id }, data: updateData }),
    ]);
  } catch (e) {
    if (e && typeof e === "object" && (e as { code?: string }).code === "P2002") {
      return NextResponse.json<ApiResponse>({ success: false, error: "Ya existe una carta con ese nombre en ese turno" }, { status: 409 });
    }
    throw e;
  }

  const updated = await prisma.carta.findUnique({ where: { id: params.id }, select: CARTA_SELECT });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}

/** DELETE /api/admin/menu/cartas/:id — elimina una carta VACÍA (sin categorías). ADMIN. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const count = await prisma.menuCategory.count({ where: { cartaId: params.id } });
  if (count > 0) return NextResponse.json<ApiResponse>({ success: false, error: "La carta tiene categorías; muévelas o elimínalas primero" }, { status: 409 });

  await prisma.carta.delete({ where: { id: params.id } });
  return NextResponse.json<ApiResponse>({ success: true, data: { id: params.id } });
}
