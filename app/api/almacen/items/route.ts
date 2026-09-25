import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import { round3 } from "@/lib/stock";
import type { ApiResponse } from "@/types";

const WRITE_DENIED = "Solo un Manager administra el catálogo del almacén";
const isP2002 = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
const STOCK_UNITS = ["PIEZA", "KG", "GRAMO", "LITRO", "ML", "CAJA", "PAQUETE"] as const;
type StockUnitT = (typeof STOCK_UNITS)[number];

/** Serializa un StockItem con los Decimal como Number y su bandera `low`. */
function serializeItem(it: { stock: unknown; minStock: unknown; lastCost: unknown } & Record<string, unknown>) {
  const stock = Number(it.stock);
  const minStock = it.minStock != null ? Number(it.minStock) : null;
  return { ...it, stock, minStock, lastCost: it.lastCost != null ? Number(it.lastCost) : null, low: minStock != null && stock < minStock };
}

/**
 * GET /api/almacen/items — catálogo de almacén para las pantallas de inventario.
 * Roles: OPERATION, CAPTAIN, MANAGER, KITCHEN. Query:
 *   categoryId (número), q (busca en el nombre, insensitive), includeArchived=1.
 * Devuelve categorías ACTIVAS (position asc, name asc), cada una con sus items en el
 * mismo orden (activos, o todos con includeArchived). Decimal → Number. Cada item lleva
 * `low` = minStock no null && stock < minStock.
 */
export async function GET(request: NextRequest) {
  const s = await requireStaffRole(request, ["OPERATION", "CAPTAIN", "MANAGER", "KITCHEN"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const categoryIdRaw = searchParams.get("categoryId");
  const categoryId = categoryIdRaw != null && Number.isInteger(Number(categoryIdRaw)) ? Number(categoryIdRaw) : null;
  const q = (searchParams.get("q") ?? "").trim();
  const includeArchived = searchParams.get("includeArchived") === "1";

  const categories = await prisma.stockCategory.findMany({
    where: { tenantId: TENANT, active: true, ...(categoryId != null ? { id: categoryId } : {}) },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      items: {
        where: {
          ...(includeArchived ? {} : { active: true }),
          ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        },
        orderBy: [{ position: "asc" }, { name: "asc" }],
      },
    },
  });

  const data = categories.map((cat) => ({
    ...cat,
    items: cat.items.map((it) => serializeItem(it)),
  }));

  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * POST /api/almacen/items — crear producto. Solo MANAGER. Body { categoryId, name, unit,
 * minStock?, notes?, position? }. Nace con stock 0 y sin movimientos: para cargar
 * inventario inicial se registra una ENTRADA (que deja rastro). No acepta `stock`.
 */
export async function POST(request: NextRequest) {
  const s = await requireStaffRole(request, ["MANAGER"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: WRITE_DENIED }, { status: 403 });
  if (s.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const body = await request.json().catch(() => ({}));

  // El stock NO se captura al crear: el inventario inicial se carga con una ENTRADA.
  if (body != null && typeof body === "object" && "stock" in body) {
    return NextResponse.json<ApiResponse>({ success: false, error: "El stock no se captura al crear: registra una entrada" }, { status: 400 });
  }

  const categoryId = Number.isInteger(body?.categoryId) && body.categoryId > 0 ? body.categoryId : null;
  if (categoryId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Categoría inválida" }, { status: 400 });
  const category = await prisma.stockCategory.findFirst({ where: { id: categoryId, tenantId: TENANT }, select: { active: true } });
  if (!category) return NextResponse.json<ApiResponse>({ success: false, error: "Categoría no encontrada" }, { status: 404 });
  if (!category.active) return NextResponse.json<ApiResponse>({ success: false, error: "Esa categoría está archivada" }, { status: 409 });

  const name = (typeof body?.name === "string" ? body.name.trim() : "").slice(0, 80);
  if (!name) return NextResponse.json<ApiResponse>({ success: false, error: "El nombre es obligatorio" }, { status: 400 });

  const unit = body?.unit;
  if (typeof unit !== "string" || !STOCK_UNITS.includes(unit as StockUnitT)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unidad inválida" }, { status: 400 });
  }

  let minStock: number | null = null;
  if (body?.minStock != null) {
    const m = Number(body.minStock);
    if (!Number.isFinite(m) || m < 0) return NextResponse.json<ApiResponse>({ success: false, error: "Mínimo inválido (número ≥ 0)" }, { status: 400 });
    minStock = round3(m);
  }
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 500) || null : null;
  const position = Number.isInteger(body?.position) && body.position >= 0 ? body.position : null;

  const existing = await prisma.stockItem.findFirst({ where: { tenantId: TENANT, categoryId, name }, select: { active: true } });
  if (existing) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: existing.active ? "Ya existe un producto con ese nombre en esa categoría" : "Ya existe un producto con ese nombre en esa categoría; ya existe archivado, restáuralo" },
      { status: 409 },
    );
  }

  try {
    const created = await prisma.stockItem.create({
      data: { tenantId: TENANT, categoryId, name, unit: unit as StockUnitT, minStock, notes, position },
    });
    return NextResponse.json<ApiResponse>({ success: true, data: serializeItem(created) }, { status: 201 });
  } catch (e) {
    if (isP2002(e)) return NextResponse.json<ApiResponse>({ success: false, error: "Ya existe un producto con ese nombre en esa categoría" }, { status: 409 });
    console.error("[almacen/items] POST", e);
    return NextResponse.json<ApiResponse>({ success: false, error: "No se pudo crear el producto" }, { status: 500 });
  }
}
