import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/staff-auth-server";
import { resolvePin, PinConflictError } from "@/lib/staff";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/admin/staff/:id/reset-pin   { pin? }
 * Resetea el PIN del empleado. Si no se envía `pin`, genera uno aleatorio
 * único en el tenant. Devuelve el PIN en claro UNA sola vez (`data.pin`):
 * ya no se puede consultar después. Solo MANAGER.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const m = await requireManager(request);
  if (!m) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const desiredPin: string | undefined =
    typeof body?.pin === "string" && /^\d{4}$/.test(body.pin) ? body.pin : undefined;
  if (body?.pin !== undefined && desiredPin === undefined) {
    return NextResponse.json<ApiResponse>({ success: false, error: "El PIN debe ser de 4 dígitos" }, { status: 400 });
  }

  const target = await prisma.staff.findFirst({ where: { id, tenantId: m.tenantId }, select: { id: true } });
  if (!target) return NextResponse.json<ApiResponse>({ success: false, error: "Empleado no encontrado" }, { status: 404 });

  try {
    const { pin, hash } = await resolvePin(desiredPin, { tenantId: m.tenantId, excludeStaffId: id });
    await prisma.staff.update({ where: { id }, data: { pinHash: hash } });
    return NextResponse.json<ApiResponse>({ success: true, data: { id, pin } });
  } catch (e) {
    if (e instanceof PinConflictError) {
      return NextResponse.json<ApiResponse>({ success: false, error: "PIN_TAKEN" }, { status: 409 });
    }
    return NextResponse.json<ApiResponse>({ success: false, error: "Error al resetear PIN" }, { status: 500 });
  }
}
