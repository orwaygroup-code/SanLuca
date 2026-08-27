import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession, requireStaffRole } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

// Quién puede marcar/limpiar faltantes: encargado de área / caja / Capitán / Manager.
const MANAGE_86 = ["OPERATION", "CAPTAIN", "MANAGER"] as const;

/**
 * GET /api/eighty-six — #6 lista de faltantes ACTIVOS (clearedAt NULL). La ve cualquier
 * empleado logueado (los meseros para no venderlos). Ordena por área y antigüedad.
 */
export async function GET(request: NextRequest) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const list = await prisma.eightySix.findMany({
    where: { tenantId: TENANT, clearedAt: null },
    orderBy: [{ area: "asc" }, { createdAt: "desc" }],
    select: { id: true, dishId: true, label: true, area: true, note: true, createdByName: true, createdAt: true },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: list });
}

/**
 * POST /api/eighty-six — #6 marca un producto como faltante. Roles: encargado/Operación/
 * Capitán/Manager. Body: { dishId?, label, area?, note? }. Si mandas dishId toma el nombre
 * y el área del platillo cuando no vengan explícitos.
 */
export async function POST(request: NextRequest) {
  const s = await requireStaffRole(request, [...MANAGE_86]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "Solo encargado de área / Manager" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const dishId = typeof body?.dishId === "string" && body.dishId.trim() ? body.dishId.trim() : null;
  let label = typeof body?.label === "string" ? body.label.trim() : "";
  let area = body?.area === "BARRA" || body?.area === "COCINA" ? body.area : null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 160) || null : null;

  if (dishId) {
    const dish = await prisma.dish.findFirst({ where: { id: dishId }, select: { name: true, prepArea: true } });
    if (!dish) return NextResponse.json<ApiResponse>({ success: false, error: "Platillo no encontrado" }, { status: 404 });
    if (!label) label = dish.name;
    if (!area) area = dish.prepArea ?? null;
    // Evita duplicados activos del mismo platillo.
    const dup = await prisma.eightySix.findFirst({ where: { tenantId: TENANT, dishId, clearedAt: null }, select: { id: true } });
    if (dup) return NextResponse.json<ApiResponse>({ success: false, error: "Ese producto ya está en la lista de faltantes" }, { status: 409 });
  }
  if (!label) return NextResponse.json<ApiResponse>({ success: false, error: "Indica el producto faltante" }, { status: 400 });

  const staff = await prisma.staff.findUnique({ where: { id: s.staffId }, select: { fullName: true } });
  const created = await prisma.eightySix.create({
    data: { tenantId: TENANT, dishId, label, area, note, createdById: s.staffId, createdByName: staff?.fullName ?? "—" },
    select: { id: true, dishId: true, label: true, area: true, note: true, createdByName: true, createdAt: true },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: created }, { status: 201 });
}
