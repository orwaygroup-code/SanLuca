import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { menuCategoryCreateSchema } from "@/lib/validations";
import type { ApiResponse } from "@/types";

/** GET /api/admin/menu/categories — categorías para el selector del CRUD. ADMIN. */
export async function GET(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const cats = await prisma.menuCategory.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, position: true, _count: { select: { dishes: true } } },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: cats });
}

/** POST /api/admin/menu/categories { name, position? } — crea categoría. ADMIN. */
export async function POST(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = menuCategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    const errors = Object.values(parsed.error.flatten().fieldErrors).flat();
    return NextResponse.json<ApiResponse>({ success: false, error: errors.join(", ") }, { status: 400 });
  }

  const created = await prisma.menuCategory.create({
    data: { name: parsed.data.name, position: parsed.data.position ?? null },
    select: { id: true, name: true, position: true },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: created }, { status: 201 });
}
