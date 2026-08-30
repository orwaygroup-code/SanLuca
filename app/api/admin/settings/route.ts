import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveActor, requireAdminOrStaffManager } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import { normalizePolicy } from "@/lib/tips";
import { validateSchedule, slugKey, parseHm, type ScheduleConfig } from "@/lib/shifts";
import type { ApiResponse } from "@/types";

/** Crea la fila de settings del tenant si no existe (IVA 16% activo por default). */
async function ensureSettings() {
  const existing = await prisma.restaurantSettings.findUnique({ where: { tenantId: TENANT } });
  return existing ?? prisma.restaurantSettings.create({ data: { tenantId: TENANT } });
}

/** GET /api/admin/settings — cualquier staff o ADMIN logueado (el cálculo de totales lo consulta). */
export async function GET(request: NextRequest) {
  const a = await resolveActor(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });
  const settings = await ensureSettings();
  return NextResponse.json<ApiResponse>({ success: true, data: settings });
}

/** PATCH /api/admin/settings — ADMIN (sl_session) o MANAGER (sl_staff). Registra updatedBy. */
export async function PATCH(request: NextRequest) {
  const m = await requireAdminOrStaffManager(request);
  if (!m) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });
  if (m.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario admin no está vinculado a un empleado (Staff)" }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = { updatedById: m.staffId };
  if (typeof body.taxEnabled === "boolean") data.taxEnabled = body.taxEnabled;
  if (typeof body.taxRate === "number" && body.taxRate >= 0 && body.taxRate < 1) {
    data.taxRate = body.taxRate;
  } else if (body.taxRate !== undefined) {
    return NextResponse.json<ApiResponse>({ success: false, error: "taxRate inválido (0 ≤ x < 1)" }, { status: 400 });
  }
  // Política de reparto de propinas (punto% + áreas). Solo admin/manager la edita.
  if (body.tipPolicy !== undefined) {
    data.tipPolicy = normalizePolicy(body.tipPolicy) as unknown as Prisma.InputJsonValue;
  }
  // #5 Descuento a empleados (% configurable, 0–100). Lo usa el atajo del descuento a la cuenta.
  if (body.employeeDiscountPercent !== undefined) {
    const ep = Number(body.employeeDiscountPercent);
    if (!Number.isFinite(ep) || ep < 0 || ep > 100) {
      return NextResponse.json<ApiResponse>({ success: false, error: "employeeDiscountPercent inválido (0 ≤ x ≤ 100)" }, { status: 400 });
    }
    data.employeeDiscountPercent = ep;
  }
  // Horario por día y turnos de servicio. Se valida aquí y no sólo en la
  // pantalla: un horario incoherente deja ventas sin turno asignado, y eso
  // rompe cortes y reportes en silencio.
  if (body.schedule !== undefined) {
    const cfg = body.schedule as ScheduleConfig;
    const errs = validateSchedule(cfg);
    if (errs.length) {
      return NextResponse.json<ApiResponse>({ success: false, error: errs.join(" ") }, { status: 400 });
    }
    // Las claves se conservan al renombrar y sólo se generan para turnos
    // nuevos: las comandas ya guardadas apuntan a la clave, no al nombre.
    const shifts = cfg.shifts
      .map((s) => ({ key: s.key || slugKey(s.name), name: s.name.trim(), start: s.start.trim() }))
      .sort((a, b) => (parseHm(a.start) ?? 0) - (parseHm(b.start) ?? 0));
    data.schedule = { days: cfg.days, shifts } as unknown as Prisma.InputJsonValue;
  }

  await ensureSettings();
  const updated = await prisma.restaurantSettings.update({ where: { tenantId: TENANT }, data });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
