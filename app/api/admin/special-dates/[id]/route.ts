import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import type { ApiResponse } from "@/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const s = await requireAdmin(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.label === "string") data.label = body.label.trim();
  if (typeof body.amount === "number" && body.amount >= 0) data.amount = body.amount;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.month === "number" && body.month >= 1 && body.month <= 12) data.month = body.month;
  if (typeof body.day === "number" && body.day >= 1 && body.day <= 31) data.day = body.day;

  if (Object.keys(data).length === 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Sin cambios" }, { status: 400 });
  }

  try {
    const updated = await runWithSession(s, () =>
      withApp((db) => db.specialDate.update({ where: { id: params.id }, data }))
    );
    return NextResponse.json<ApiResponse>({ success: true, data: updated });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: "Error al actualizar" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const s = await requireAdmin(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  try {
    await runWithSession(s, () =>
      withApp((db) => db.specialDate.delete({ where: { id: params.id } }))
    );
    return NextResponse.json<ApiResponse>({ success: true });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: "Error al eliminar" }, { status: 400 });
  }
}
