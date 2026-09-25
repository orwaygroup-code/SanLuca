import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import { resolveDateRange } from "@/lib/dateRange";
import { STOCK_MOVE_TYPES, round3, type StockMoveType } from "@/lib/stock";
import type { ApiResponse } from "@/types";

const LIMIT = 500; // tope duro de filas; el resumen (totals/byReason) se calcula aparte sobre TODO el rango.

function intOrNull(v: string | null): number | null {
  const n = Number(v);
  return v != null && Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * GET /api/admin/almacen/movements — auditoría de movimientos del almacén (solo lectura).
 * ADMIN. Rango con el mismo helper de fechas que /api/admin/comandas. Filtros opcionales y
 * combinables: type, itemId, staffId, categoryId. Devuelve movements (máx 500, orden
 * createdAt desc), truncated, totals por tipo y byReason (suma por motivo). Decimal → Number.
 */
export async function GET(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const { from, to } = resolveDateRange(sp);

  const typeParam = sp.get("type");
  const type = typeParam && STOCK_MOVE_TYPES.includes(typeParam as StockMoveType) ? (typeParam as StockMoveType) : null;
  const itemId = intOrNull(sp.get("itemId"));
  const staffId = intOrNull(sp.get("staffId"));
  const categoryId = intOrNull(sp.get("categoryId"));

  const where = {
    tenantId: TENANT,
    createdAt: { gte: from, lte: to },
    ...(type ? { type } : {}),
    ...(itemId != null ? { itemId } : {}),
    ...(staffId != null ? { createdById: staffId } : {}),
    ...(categoryId != null ? { item: { categoryId } } : {}),
  };

  // Listado. Pido LIMIT+1 para detectar el truncado sin un count extra.
  const rows = await prisma.stockMovement.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: LIMIT + 1,
    select: {
      id: true, createdAt: true, type: true, quantity: true, balanceAfter: true,
      reasonCode: true, reason: true, unitCost: true, supplier: true,
      item: { select: { id: true, name: true, unit: true, category: { select: { id: true, name: true } } } },
      createdBy: { select: { id: true, fullName: true } },
    },
  });
  const truncated = rows.length > LIMIT;
  const movements = (truncated ? rows.slice(0, LIMIT) : rows).map((m) => ({
    id: m.id,
    createdAt: m.createdAt.toISOString(),
    type: m.type,
    quantity: Number(m.quantity),
    balanceAfter: Number(m.balanceAfter),
    reasonCode: m.reasonCode,
    reason: m.reason,
    unitCost: m.unitCost != null ? Number(m.unitCost) : null,
    supplier: m.supplier,
    item: { id: m.item.id, name: m.item.name, unit: m.item.unit, category: { id: m.item.category.id, name: m.item.category.name } },
    createdBy: { id: m.createdBy.id, fullName: m.createdBy.fullName },
  }));

  // Resumen SOBRE EL MISMO rango+filtros (no limitado a 500). La UNIDAD vive en StockItem,
  // no en StockMovement, así que agrupo por (type,itemId) y (reasonCode,itemId), leo la unidad
  // de los items implicados y hago el rollup por unidad en el servidor. Sumar kg con piezas
  // mentiría; los AJUSTE (cuya cantidad es un conteo, no algo que se movió) se excluyen de las
  // sumas: solo cuentan movimientos.
  const byReasonExcludesAjuste = type === null ? { type: { not: "AJUSTE" as StockMoveType } } : {};
  const [byTypeRows, byReasonRows] = await Promise.all([
    prisma.stockMovement.groupBy({ by: ["type", "itemId"], where, _count: { _all: true }, _sum: { quantity: true } }),
    type === "AJUSTE"
      ? Promise.resolve([] as { reasonCode: string | null; itemId: number; _sum: { quantity: unknown } }[])
      : prisma.stockMovement.groupBy({ by: ["reasonCode", "itemId"], where: { ...where, ...byReasonExcludesAjuste }, _sum: { quantity: true } }),
  ]);

  const itemIds = [...new Set([...byTypeRows.map((g) => g.itemId), ...byReasonRows.map((g) => g.itemId)])];
  const unitItems = itemIds.length ? await prisma.stockItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, unit: true } }) : [];
  const unitById = new Map(unitItems.map((i) => [i.id, i.unit as string]));

  // totals: ENTRADA/SALIDA/MERMA → count + sums por unidad; AJUSTE → solo count (nunca suma).
  const totals: Record<string, { count: number; sums?: { unit: string; sum: number }[] }> = {};
  const unitAcc: Record<string, Map<string, number>> = {};
  for (const t of STOCK_MOVE_TYPES) { totals[t] = { count: 0, ...(t === "AJUSTE" ? {} : { sums: [] }) }; unitAcc[t] = new Map(); }
  for (const g of byTypeRows) {
    totals[g.type].count += g._count._all;
    if (g.type !== "AJUSTE") {
      const unit = unitById.get(g.itemId) ?? "?";
      unitAcc[g.type].set(unit, (unitAcc[g.type].get(unit) ?? 0) + Number(g._sum.quantity ?? 0));
    }
  }
  for (const t of STOCK_MOVE_TYPES) {
    if (t !== "AJUSTE") totals[t].sums = [...unitAcc[t].entries()].map(([unit, sum]) => ({ unit, sum: round3(sum) }));
  }

  // byReason: suma por (motivo, unidad), excluyendo AJUSTE. Filas sin motivo → "Sin motivo".
  const reasonAcc = new Map<string, number>();
  for (const g of byReasonRows) {
    const key = `${g.reasonCode ?? "Sin motivo"}\u0000${unitById.get(g.itemId) ?? "?"}`;
    reasonAcc.set(key, (reasonAcc.get(key) ?? 0) + Number(g._sum.quantity ?? 0));
  }
  const byReason = [...reasonAcc.entries()]
    .map(([key, sum]) => { const [reasonCode, unit] = key.split("\u0000"); return { reasonCode, unit, sum: round3(sum) }; })
    .sort((x, y) => y.sum - x.sum);

  return NextResponse.json<ApiResponse>({ success: true, data: { movements, truncated, totals, byReason } });
}
