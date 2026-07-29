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
  available: true, isExtra: true, position: true, prepArea: true, categoryId: true,
  category: { select: { id: true, name: true } },
  createdAt: true,
} as const;

/** GET /api/admin/menu?isExtra=&q=&categoryId=&available= — lista. ADMIN. */
export async function GET(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const isExtra = searchParams.get("isExtra");
  const q = searchParams.get("q")?.trim();
  const categoryId = searchParams.get("categoryId");
  const available = searchParams.get("available");

  const dishes = await prisma.dish.findMany({
    where: {
      ...(isExtra === "true" ? { isExtra: true } : isExtra === "false" ? { isExtra: false } : {}),
      ...(categoryId ? { categoryId } : {}),
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
