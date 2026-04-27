import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ApiResponse } from "@/types";

async function verifyAdmin(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user && user.role === "ADMIN" ? userId : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "No autorizado" },
      { status: 403 }
    );
  }
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.label === "string") data.label = body.label.trim();
  if (typeof body.amount === "number" && body.amount >= 0) data.amount = body.amount;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.month === "number" && body.month >= 1 && body.month <= 12) data.month = body.month;
  if (typeof body.day === "number" && body.day >= 1 && body.day <= 31) data.day = body.day;

  if (Object.keys(data).length === 0) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Sin cambios" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.specialDate.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json<ApiResponse>({ success: true, data: updated });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Error al actualizar" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "No autorizado" },
      { status: 403 }
    );
  }
  try {
    await prisma.specialDate.delete({ where: { id: params.id } });
    return NextResponse.json<ApiResponse>({ success: true });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Error al eliminar" },
      { status: 400 }
    );
  }
}
