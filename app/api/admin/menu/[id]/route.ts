import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { dishUpdateSchema } from "@/lib/validations";
import type { ApiResponse } from "@/types";

const DISH_SELECT = {
  id: true, name: true, description: true, price: true, imageUrl: true,
  available: true, isExtra: true, position: true, prepArea: true, categoryId: true,
  category: { select: { id: true, name: true } },
  createdAt: true,
} as const;

/** PATCH /api/admin/menu/:id — actualiza un platillo. ADMIN. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = dishUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const errors = Object.values(parsed.error.flatten().fieldErrors).flat();
    return NextResponse.json<ApiResponse>({ success: false, error: errors.join(", ") }, { status: 400 });
  }
  const d = parsed.data;

  const exists = await prisma.dish.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json<ApiResponse>({ success: false, error: "Platillo no encontrado" }, { status: 404 });

  if (d.categoryId !== undefined) {
    const cat = await prisma.menuCategory.findUnique({ where: { id: d.categoryId }, select: { id: true } });
    if (!cat) return NextResponse.json<ApiResponse>({ success: false, error: "Categoría no encontrada" }, { status: 404 });
  }

  const updated = await prisma.dish.update({
    where: { id: params.id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.description !== undefined ? { description: d.description ?? null } : {}),
      ...(d.price !== undefined ? { price: d.price } : {}),
      ...(d.imageUrl !== undefined ? { imageUrl: d.imageUrl ?? null } : {}),
      ...(d.categoryId !== undefined ? { categoryId: d.categoryId } : {}),
      ...(d.prepArea !== undefined ? { prepArea: d.prepArea ?? null } : {}),
      ...(d.available !== undefined ? { available: d.available } : {}),
      ...(d.isExtra !== undefined ? { isExtra: d.isExtra } : {}),
      ...(d.position !== undefined ? { position: d.position ?? null } : {}),
    },
    select: DISH_SELECT,
  });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}

/** DELETE /api/admin/menu/:id — elimina si no está en uso; si no, sugiere ocultar. ADMIN. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const exists = await prisma.dish.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json<ApiResponse>({ success: false, error: "Platillo no encontrado" }, { status: 404 });

  const [inComandas, inReservas] = await Promise.all([
    prisma.comandaItem.count({ where: { dishId: params.id } }),
    prisma.reservationItem.count({ where: { dishId: params.id } }),
  ]);
  if (inComandas > 0 || inReservas > 0) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "No se puede eliminar: hay comandas o reservas que lo usan. Ocúltalo del menú en su lugar." },
      { status: 409 },
    );
  }

  await prisma.dish.delete({ where: { id: params.id } });
  return NextResponse.json<ApiResponse>({ success: true, data: { id: params.id } });
}
