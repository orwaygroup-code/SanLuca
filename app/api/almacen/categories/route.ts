import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

const WRITE_DENIED = "Solo un Manager administra el catálogo del almacén";
const isP2002 = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

/**
 * GET /api/almacen/categories — categorías del almacén (Almacén A-2).
 * Roles: OPERATION, CAPTAIN, MANAGER, KITCHEN. Query includeArchived=1 incluye archivadas.
 * Orden position asc (nulls al final por default de Postgres), luego name asc. Cada
 * categoría lleva `itemCount` = StockItem ACTIVOS.
 */
export async function GET(request: NextRequest) {
  const s = await requireStaffRole(request, ["OPERATION", "CAPTAIN", "MANAGER", "KITCHEN"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "1";

  const categories = await prisma.stockCategory.findMany({
    where: { tenantId: TENANT, ...(includeArchived ? {} : { active: true }) },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { items: { where: { active: true } } } } },
  });

  const data = categories.map(({ _count, ...cat }) => ({ ...cat, itemCount: _count.items }));
  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * POST /api/almacen/categories — crear categoría. Solo MANAGER. Body { name, position? }.
 */
export async function POST(request: NextRequest) {
  const s = await requireStaffRole(request, ["MANAGER"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: WRITE_DENIED }, { status: 403 });
  if (s.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const name = (typeof body?.name === "string" ? body.name.trim() : "").slice(0, 80);
  if (!name) return NextResponse.json<ApiResponse>({ success: false, error: "El nombre es obligatorio" }, { status: 400 });
  const position = Number.isInteger(body?.position) && body.position >= 0 ? body.position : null;

  // Comprobación previa para dar un mensaje claro (activa vs archivada); el catch de P2002
  // cierra la ventana de dos peticiones concurrentes con el mismo nombre.
  const existing = await prisma.stockCategory.findFirst({ where: { tenantId: TENANT, name }, select: { id: true, active: true } });
  if (existing) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: existing.active ? "Ya existe una categoría con ese nombre" : "Ya existe una categoría archivada con ese nombre; restáurala" },
      { status: 409 },
    );
  }

  try {
    const created = await prisma.stockCategory.create({ data: { tenantId: TENANT, name, position } });
    return NextResponse.json<ApiResponse>({ success: true, data: created }, { status: 201 });
  } catch (e) {
    if (isP2002(e)) return NextResponse.json<ApiResponse>({ success: false, error: "Ya existe una categoría con ese nombre" }, { status: 409 });
    console.error("[almacen/categories] POST", e);
    return NextResponse.json<ApiResponse>({ success: false, error: "No se pudo crear la categoría" }, { status: 500 });
  }
}
