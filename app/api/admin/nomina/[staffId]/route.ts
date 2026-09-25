import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TENANT } from "@/lib/comanda";
import { requirePayroll } from "../route";
import type { ApiResponse } from "@/types";

const MX_OFFSET = "-06:00";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const serialize = (r: { id: number; amount: unknown; period: string; effectiveFrom: Date; note: string | null; createdAt: Date; createdBy: { fullName: string } }) => ({
  id: r.id, amount: Number(r.amount), period: r.period, effectiveFrom: r.effectiveFrom.toISOString(),
  note: r.note, createdAt: r.createdAt.toISOString(), createdBy: { fullName: r.createdBy.fullName },
});
const SALARY_SELECT = { id: true, amount: true, period: true, effectiveFrom: true, note: true, createdAt: true, createdBy: { select: { fullName: true } } } as const;

/**
 * GET /api/admin/nomina/:staffId — historial de sueldos (effectiveFrom desc). Solo payrollAccess.
 */
export async function GET(request: NextRequest, { params }: { params: { staffId: string } }) {
  const actorId = await requirePayroll(request);
  if (actorId == null) return NextResponse.json<ApiResponse>({ success: false, error: "No tienes acceso a nómina" }, { status: 403 });

  const staffId = parseId(params.staffId);
  if (!staffId) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const rows = await prisma.staffSalary.findMany({
    where: { tenantId: TENANT, staffId },
    orderBy: { effectiveFrom: "desc" },
    select: SALARY_SELECT,
  });
  return NextResponse.json<ApiResponse>({ success: true, data: rows.map(serialize) });
}

/**
 * POST /api/admin/nomina/:staffId — asignar/cambiar sueldo (append-only). Solo payrollAccess.
 * Body { amount, effectiveFrom?, note? }. Nunca actualiza un registro; crea uno nuevo con
 * period QUINCENAL. Sin `notify` (avisaría a MANAGER sin el permiso); el historial es la auditoría.
 */
export async function POST(request: NextRequest, { params }: { params: { staffId: string } }) {
  const actorId = await requirePayroll(request);
  if (actorId == null) return NextResponse.json<ApiResponse>({ success: false, error: "No tienes acceso a nómina" }, { status: 403 });

  const staffId = parseId(params.staffId);
  if (!staffId) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));

  const amount = Math.round(Number(body?.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999.99) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Monto inválido" }, { status: 400 });
  }

  // effectiveFrom: "YYYY-MM-DD" (a medianoche MX) o ISO. Se acepta pasada y futura. Default hoy.
  let effectiveFrom: Date;
  if (body?.effectiveFrom == null || body.effectiveFrom === "") {
    effectiveFrom = new Date();
  } else {
    const raw = String(body.effectiveFrom);
    effectiveFrom = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00.000${MX_OFFSET}`) : new Date(raw);
    if (Number.isNaN(effectiveFrom.getTime())) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Fecha inválida" }, { status: 400 });
    }
  }

  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 200) || null : null;

  const target = await prisma.staff.findFirst({ where: { id: staffId, tenantId: TENANT }, select: { active: true } });
  if (!target) return NextResponse.json<ApiResponse>({ success: false, error: "Empleado no encontrado" }, { status: 404 });
  if (!target.active) return NextResponse.json<ApiResponse>({ success: false, error: "El empleado está inactivo" }, { status: 409 });

  const created = await prisma.staffSalary.create({
    data: { tenantId: TENANT, staffId, amount, period: "QUINCENAL", effectiveFrom, note, createdById: actorId },
    select: SALARY_SELECT,
  });
  return NextResponse.json<ApiResponse>({ success: true, data: serialize(created) }, { status: 201 });
}
