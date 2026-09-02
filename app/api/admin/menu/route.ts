import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { dishCreateSchema } from "@/lib/validations";
import type { ApiResponse } from "@/types";

/**
 * CRUD de Platillos del menú (y Extras). Realm sl_session ADMIN (Ricardo).
 * Un "extra" es un Dish con isExtra=true (oculto del menú público, pedible por
 * meseros). El campo `available` = "Mostrar en menú".
 */

const DISH_SELECT = {
  id: true, name: true, description: true, price: true, imageUrl: true,
  available: true, active: true, archivedAt: true, isExtra: true, position: true, prepArea: true, categoryId: true,
  category: { select: { id: true, name: true, cartaId: true, carta: { select: { id: true, name: true, turno: true, clase: true } } } },
  createdAt: true,
} as const;

/** GET /api/admin/menu?isExtra=&q=&categoryId=&available=&includeDisabled= — lista. ADMIN. */
export async function GET(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const isExtra = searchParams.get("isExtra");
  const q = searchParams.get("q")?.trim();
  const categoryId = searchParams.get("categoryId");
  const cartaId = searchParams.get("cartaId");
  const available = searchParams.get("available");
  // Estado: active (default) | archived | eliminated | all. Archivar y eliminar
  // dejan active=false; archivedAt distingue archivado (sello) de eliminado (sin sello).
  const state = searchParams.get("state");
  const stateWhere =
    state === "archived" ? { active: false, NOT: { archivedAt: null } } :
    state === "eliminated" ? { active: false, archivedAt: null } :
    state === "all" || searchParams.get("includeDisabled") === "true" ? {} :
    { active: true };

  const dishes = await prisma.dish.findMany({
    where: {
      ...stateWhere,
      ...(isExtra === "true" ? { isExtra: true } : isExtra === "false" ? { isExtra: false } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(cartaId ? { category: { cartaId } } : {}),
      ...(available === "true" ? { available: true } : available === "false" ? { available: false } : {}),
      ...(q ? { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ] } : {}),
    },
    select: DISH_SELECT,
    orderBy: [{ category: { position: "asc" } }, { position: "asc" }, { name: "asc" }],
  });

  return NextResponse.json<ApiResponse>({ success: true, data: dishes });
}

/** POST /api/admin/menu { name, price, categoryId, ... } — crea platillo/extra. ADMIN. */
export async function POST(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = dishCreateSchema.safeParse(body);
  if (!parsed.success) {
    const errors = Object.values(parsed.error.flatten().fieldErrors).flat();
    return NextResponse.json<ApiResponse>({ success: false, error: errors.join(", ") }, { status: 400 });
  }
  const d = parsed.data;

  const cat = await prisma.menuCategory.findUnique({ where: { id: d.categoryId }, select: { id: true } });
  if (!cat) return NextResponse.json<ApiResponse>({ success: false, error: "Categoría no encontrada" }, { status: 404 });

  const created = await prisma.dish.create({
    data: {
      name: d.name,
      description: d.description ?? null,
      price: d.price,
      imageUrl: d.imageUrl ?? null,
      categoryId: d.categoryId,
      prepArea: d.prepArea ?? null,
      available: d.available ?? true,
      isExtra: d.isExtra ?? false,
      position: d.position ?? null,
    },
    select: DISH_SELECT,
  });
  return NextResponse.json<ApiResponse>({ success: true, data: created }, { status: 201 });
}
