import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/staff-auth-server";
import { staffUpdateSchema } from "@/lib/validations";
import type { ApiResponse } from "@/types";

const PUBLIC_SELECT = {
  id: true, username: true, fullName: true, role: true, active: true,
  lastLoginAt: true, lastShift: true, createdAt: true, updatedAt: true,
} as const;

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * PATCH /api/admin/staff/:id  { fullName?, role?, active? }
 * Editar empleado / desactivar-reactivar (soft-delete vía active). Solo MANAGER.
 * El PIN NO se cambia aquí — usar POST /api/admin/staff/:id/reset-pin.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const m = await requireManager(request);
  if (!m) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = staffUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const errors = Object.values(parsed.error.flatten().fieldErrors).flat();
    const formErr = parsed.error.flatten().formErrors;
    return NextResponse.json<ApiResponse>(
      { success: false, error: [...errors, ...formErr].join(", ") || "Datos inválidos" },
      { status: 400 }
    );
  }

  // Un MANAGER no puede auto-desactivarse ni quitarse el rol (evita lockout).
  if (id === m.staffId && (parsed.data.active === false || (parsed.data.role && parsed.data.role !== "MANAGER"))) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "No puedes desactivar ni cambiar tu propio rol de MANAGER" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.staff.update({
      where: { id, tenantId: m.tenantId },
      data: parsed.data,
      select: PUBLIC_SELECT,
    });
    return NextResponse.json<ApiResponse>({ success: true, data: updated });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: "Empleado no encontrado" }, { status: 404 });
  }
}

/**
 * DELETE /api/admin/staff/:id — soft-delete (active = false). Solo MANAGER.
 * No se borra físicamente: conservamos histórico de comandas (Fase B).
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const m = await requireManager(request);
  if (!m) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });
  if (id === m.staffId) {
    return NextResponse.json<ApiResponse>({ success: false, error: "No puedes desactivarte a ti mismo" }, { status: 400 });
  }

  try {
    const updated = await prisma.staff.update({
      where: { id, tenantId: m.tenantId },
      data: { active: false },
      select: PUBLIC_SELECT,
    });
    return NextResponse.json<ApiResponse>({ success: true, data: updated });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: "Empleado no encontrado" }, { status: 404 });
  }
}
