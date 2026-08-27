import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/staff-auth-server";
import type { ApiResponse } from "@/types";

/**
 * PATCH /api/dishes/:id/featured — #7 "101": prende/apaga el flag de priorizar venta de un
 * platillo. Body: { featured: boolean }. Lo maneja Capitán o Manager. Los meseros solo lo ven.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireStaffRole(request, ["CAPTAIN", "MANAGER"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Capitán / Manager" }, { status: 403 });

  const id = typeof params.id === "string" ? params.id : "";
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  if (typeof body?.featured !== "boolean") {
    return NextResponse.json<ApiResponse>({ success: false, error: "featured (boolean) es obligatorio" }, { status: 400 });
  }

  const dish = await prisma.dish.findFirst({ where: { id }, select: { id: true } });
  if (!dish) return NextResponse.json<ApiResponse>({ success: false, error: "Platillo no encontrado" }, { status: 404 });

  const updated = await prisma.dish.update({
    where: { id },
    data: { featured101: body.featured },
    select: { id: true, name: true, featured101: true },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
