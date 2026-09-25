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

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function serializeItem(it: { stock: unknown; minStock: unknown; lastCost: unknown } & Record<string, unknown>) {
  const stock = Number(it.stock);
  const minStock = it.minStock != null ? Number(it.minStock) : null;
  return { ...it, stock, minStock, lastCost: it.lastCost != null ? Number(it.lastCost) : null, low: minStock != null && stock < minStock };
}

/**
 * PATCH /api/almacen/items/:id — editar, mover, archivar o restaurar un producto. Solo
 * MANAGER. Nunca borra (no hay handler de borrado) y NUNCA escribe `stock` (eso es un movimiento). La
 * unidad solo cambia si el producto no tiene movimientos (si no, mentiría su historial).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireStaffRole(request, ["MANAGER"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: WRITE_DENIED }, { status: 403 });
  if (s.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const item = await prisma.stockItem.findFirst({ where: { id, tenantId: TENANT }, select: { id: true, name: true, categoryId: true, unit: true } });
  if (!item) return NextResponse.json<ApiResponse>({ success: false, error: "Producto no encontrado" }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  // Guarda central de toda la ola: el stock NO se edita aquí, se registra un movimiento.
  if (body != null && typeof body === "object" && "stock" in body) {
    return NextResponse.json<ApiResponse>({ success: false, error: "El stock no se edita: registra un movimiento" }, { status: 400 });
  }

  const data: {
    name?: string; categoryId?: number; unit?: StockUnitT; minStock?: number | null;
    notes?: string | null; position?: number | null; active?: boolean; archivedAt?: Date | null;
  } = {};

  if (body?.name !== undefined) {
    const name = (typeof body.name === "string" ? body.name.trim() : "").slice(0, 80);
    if (!name) return NextResponse.json<ApiResponse>({ success: false, error: "El nombre es obligatorio" }, { status: 400 });
    data.name = name;
  }

  // Mover de categoría: la destino debe existir y estar activa.
  let targetCat = item.categoryId;
  if (body?.categoryId !== undefined) {
    const cid = Number.isInteger(body.categoryId) && body.categoryId > 0 ? body.categoryId : null;
    if (cid == null) return NextResponse.json<ApiResponse>({ success: false, error: "Categoría inválida" }, { status: 400 });
    if (cid !== item.categoryId) {
      const cat = await prisma.stockCategory.findFirst({ where: { id: cid, tenantId: TENANT }, select: { active: true } });
      if (!cat) return NextResponse.json<ApiResponse>({ success: false, error: "Categoría no encontrada" }, { status: 404 });
      if (!cat.active) return NextResponse.json<ApiResponse>({ success: false, error: "Esa categoría está archivada" }, { status: 409 });
    }
    data.categoryId = cid;
    targetCat = cid;
  }

  // La unidad solo cambia si NO hay movimientos (pasar de KG a PIEZA volvería mentira el historial).
  if (body?.unit !== undefined) {
    const unit = body.unit;
    if (typeof unit !== "string" || !STOCK_UNITS.includes(unit as StockUnitT)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Unidad inválida" }, { status: 400 });
    }
    if (unit !== item.unit) {
      const moves = await prisma.stockMovement.count({ where: { tenantId: TENANT, itemId: id } });
      if (moves > 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: "Ese producto ya tiene movimientos registrados: no se puede cambiar su unidad" }, { status: 409 });
      }
      data.unit = unit as StockUnitT;
    }
  }

  if (body?.minStock !== undefined) {
    if (body.minStock === null) {
      data.minStock = null;
    } else {
      const m = Number(body.minStock);
      if (!Number.isFinite(m) || m < 0) return NextResponse.json<ApiResponse>({ success: false, error: "Mínimo inválido (número ≥ 0)" }, { status: 400 });
      data.minStock = round3(m);
    }
  }
  if (body?.notes !== undefined) data.notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) || null : null;
  if (body?.position !== undefined) data.position = Number.isInteger(body.position) && body.position >= 0 ? body.position : null;

  if (body?.active === true) {
    data.active = true;
    data.archivedAt = null; // restaurar (el historial de movimientos se conserva siempre)
  } else if (body?.active === false) {
    data.active = false;
    data.archivedAt = new Date(); // archivar
  }

  // Choque de nombre en la categoría destino (mismo unique que crear), excluyendo a sí mismo.
  if (body?.name !== undefined || body?.categoryId !== undefined) {
    const effName = data.name ?? item.name;
    const clash = await prisma.stockItem.findFirst({ where: { tenantId: TENANT, categoryId: targetCat, name: effName, id: { not: id } }, select: { active: true } });
    if (clash) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: clash.active ? "Ya existe un producto con ese nombre en esa categoría" : "Ya existe un producto con ese nombre en esa categoría; ya existe archivado, restáuralo" },
        { status: 409 },
      );
    }
  }

  try {
    const updated = await prisma.stockItem.update({ where: { id }, data });
    return NextResponse.json<ApiResponse>({ success: true, data: serializeItem(updated) });
  } catch (e) {
    if (isP2002(e)) return NextResponse.json<ApiResponse>({ success: false, error: "Ya existe un producto con ese nombre en esa categoría" }, { status: 409 });
    console.error("[almacen/items/:id] PATCH", e);
    return NextResponse.json<ApiResponse>({ success: false, error: "No se pudo actualizar el producto" }, { status: 500 });
  }
}
