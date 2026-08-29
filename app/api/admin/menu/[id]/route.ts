import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { dishUpdateSchema } from "@/lib/validations";
import type { ApiResponse } from "@/types";

const DISH_SELECT = {
  id: true, name: true, description: true, price: true, imageUrl: true,
  available: true, active: true, archivedAt: true, isExtra: true, position: true, prepArea: true, categoryId: true,
  category: { select: { id: true, name: true, cartaId: true, carta: { select: { id: true, name: true, turno: true, clase: true } } } },
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
      // Retiro/restauración. `archived` tiene prioridad: archivar boxea (active=false + sello);
      // eliminar/restaurar (via `active`) siempre limpian el sello para no dejar estados mixtos.
      ...(d.active !== undefined ? { active: d.active, archivedAt: null } : {}),
      ...(d.archived === true ? { active: false, archivedAt: new Date() } : {}),
      ...(d.archived === false ? { active: true, archivedAt: null } : {}),
    },
    select: DISH_SELECT,
  });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}

// Sin DELETE a propósito: los platillos NO se borran (romperían los históricos de
// venta). Para retirar uno se ARCHIVA (PATCH { archived:true }) o se ELIMINA (PATCH
// { active:false }); ambos ocultan/deshabilitan el platillo pero conservan el registro
// y sus ventas. Restaurar = PATCH { active:true } (o { archived:false }).
