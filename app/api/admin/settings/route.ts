import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession, requireManager } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

/** Crea la fila de settings del tenant si no existe (IVA 16% activo por default). */
async function ensureSettings() {
  const existing = await prisma.restaurantSettings.findUnique({ where: { tenantId: TENANT } });
  return existing ?? prisma.restaurantSettings.create({ data: { tenantId: TENANT } });
}

/** GET /api/admin/settings — cualquier staff logueado (el cálculo de totales lo consulta). */
export async function GET(request: NextRequest) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });
  const settings = await ensureSettings();
  return NextResponse.json<ApiResponse>({ success: true, data: settings });
}

/** PATCH /api/admin/settings — solo MANAGER. Registra updatedBy. */
export async function PATCH(request: NextRequest) {
  const m = await requireManager(request);
  if (!m) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = { updatedById: m.staffId };
  if (typeof body.taxEnabled === "boolean") data.taxEnabled = body.taxEnabled;
  if (typeof body.taxRate === "number" && body.taxRate >= 0 && body.taxRate < 1) {
    data.taxRate = body.taxRate;
  } else if (body.taxRate !== undefined) {
    return NextResponse.json<ApiResponse>({ success: false, error: "taxRate inválido (0 ≤ x < 1)" }, { status: 400 });
  }

  await ensureSettings();
  const updated = await prisma.restaurantSettings.update({ where: { tenantId: TENANT }, data });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
