import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { resolvePin, PinConflictError } from "@/lib/staff";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/admin/employees/:id/reset-pin { pin? } — regenera PIN, lo devuelve
 * UNA vez. ADMIN (sl_session).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const desiredPin: string | undefined =
    typeof body?.pin === "string" && /^\d{4}$/.test(body.pin) ? body.pin : undefined;
  if (body?.pin !== undefined && desiredPin === undefined) {
    return NextResponse.json<ApiResponse>({ success: false, error: "El PIN debe ser de 4 dígitos" }, { status: 400 });
  }

  const target = await prisma.staff.findFirst({ where: { id, tenantId: TENANT }, select: { id: true } });
  if (!target) return NextResponse.json<ApiResponse>({ success: false, error: "Empleado no encontrado" }, { status: 404 });

  try {
    const { pin, hash } = await resolvePin(desiredPin, { tenantId: TENANT, excludeStaffId: id });
    await prisma.staff.update({ where: { id }, data: { pinHash: hash } });
    return NextResponse.json<ApiResponse>({ success: true, data: { id, pin } });
  } catch (e) {
    if (e instanceof PinConflictError) {
      return NextResponse.json<ApiResponse>({ success: false, error: "PIN_TAKEN" }, { status: 409 });
    }
    return NextResponse.json<ApiResponse>({ success: false, error: "Error al resetear PIN" }, { status: 500 });
  }
}
