import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { staffUpdateSchema } from "@/lib/validations";
import { TENANT } from "@/lib/comanda";
import { syncAdminBridge } from "@/lib/adminBridge";
import type { ApiResponse } from "@/types";

const PUBLIC_SELECT = {
  id: true, username: true, fullName: true, role: true, active: true,
  lastLoginAt: true, lastShift: true, createdAt: true, updatedAt: true,
} as const;

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** PATCH /api/admin/employees/:id { username?, fullName?, role?, active? } — editar/soft-delete. ADMIN. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

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

  // El admin no puede desactivar ni degradar su propio Staff vinculado (evita lockout).
  if (a.staffId != null && id === a.staffId && (parsed.data.active === false || (parsed.data.role && parsed.data.role !== "MANAGER"))) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "No puedes desactivar ni cambiar tu propio rol de MANAGER" },
      { status: 400 }
    );
  }

  try {
    const data = {
      ...parsed.data,
      ...(parsed.data.username ? { username: parsed.data.username.toLowerCase() } : {}),
    };
    const updated = await prisma.staff.update({
      where: { id, tenantId: TENANT },
      data,
      select: PUBLIC_SELECT,
    });
    // El puesto y los privilegios se mueven juntos: promover a MANAGER concede
    // el panel, y cualquier otro puesto lo revoca. Antes había que recordar
    // correr un script a mano, así que el rol mostrado y el acceso real podían
    // no coincidir durante semanas.
    const bridge = await syncAdminBridge(updated.id, updated.role, {
      username: updated.username,
      fullName: updated.fullName,
    });
    return NextResponse.json<ApiResponse>({ success: true, data: { ...updated, bridge } });
  } catch (e) {
    const isUnique = e instanceof Error && e.message.includes("Unique constraint");
    return NextResponse.json<ApiResponse>(
      { success: false, error: isUnique ? "USERNAME_TAKEN" : "Empleado no encontrado" },
      { status: isUnique ? 409 : 404 }
    );
  }
}

/** DELETE /api/admin/employees/:id — soft-delete (active=false). ADMIN. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });
  if (a.staffId != null && id === a.staffId) {
    return NextResponse.json<ApiResponse>({ success: false, error: "No puedes desactivarte a ti mismo" }, { status: 400 });
  }

  try {
    const updated = await prisma.staff.update({
      where: { id, tenantId: TENANT },
      data: { active: false },
      select: PUBLIC_SELECT,
    });
    return NextResponse.json<ApiResponse>({ success: true, data: updated });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: "Empleado no encontrado" }, { status: 404 });
  }
}
