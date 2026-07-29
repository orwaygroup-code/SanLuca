import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { menuCategoryCreateSchema } from "@/lib/validations";
import type { ApiResponse } from "@/types";

/** GET /api/admin/menu/categories?cartaId= — categorías (secciones) del CRUD. ADMIN. */
export async function GET(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const cartaId = searchParams.get("cartaId");

  const cats = await prisma.menuCategory.findMany({
    where: { ...(cartaId ? { cartaId } : {}) },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, position: true, cartaId: true,
      carta: { select: { id: true, name: true, turno: true, clase: true } },
      _count: { select: { dishes: true } },
    },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: cats });
}

/** POST /api/admin/menu/categories { name, cartaId, position? } — crea categoría bajo una carta. ADMIN. */
export async function POST(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = menuCategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    const errors = Object.values(parsed.error.flatten().fieldErrors).flat();
    return NextResponse.json<ApiResponse>({ success: false, error: errors.join(", ") }, { status: 400 });
  }
  const cartaId = typeof body?.cartaId === "string" ? body.cartaId : "";
  if (!cartaId) return NextResponse.json<ApiResponse>({ success: false, error: "Elige la carta a la que pertenece" }, { status: 400 });
  const carta = await prisma.carta.findUnique({ where: { id: cartaId }, select: { id: true } });
  if (!carta) return NextResponse.json<ApiResponse>({ success: false, error: "Carta no encontrada" }, { status: 404 });

  const created = await prisma.menuCategory.create({
    data: { name: parsed.data.name, position: parsed.data.position ?? null, cartaId },
    select: { id: true, name: true, position: true, cartaId: true },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: created }, { status: 201 });
}
