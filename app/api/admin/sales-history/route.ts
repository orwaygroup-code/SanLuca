import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import { resolveDateRange } from "@/lib/dateRange";
import type { ApiResponse } from "@/types";

const LIMIT = 500; // tope de filas; si se rebasa, el front avisa que hay que acotar el rango.
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * GET /api/admin/sales-history?range|from|to&q — HISTÓRICO de cuentas PAGADAS (todas
 * las cuentas cobradas por fecha de cobro), solo lectura. ADMIN (sl_session).
 * Distinto de /staff/cuentas (caja, turno actual): esto es la versión histórica por fecha.
 */
export async function GET(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const { from, to, label } = resolveDateRange(sp);
  const q = sp.get("q")?.trim();

  const rows = await prisma.comanda.findMany({
    where: {
      tenantId: TENANT, status: "PAID", closedAt: { gte: from, lte: to },
      ...(q ? { OR: [
        { folio: { contains: q, mode: "insensitive" as const } },
        { customName: { contains: q, mode: "insensitive" as const } },
        { waiter: { fullName: { contains: q, mode: "insensitive" as const } } },
      ] } : {}),
    },
    select: {
      id: true, folio: true, closedAt: true, shift: true, total: true, guestsActual: true, customName: true,
      table: { select: { number: true, section: { select: { name: true } } } },
      waiter: { select: { fullName: true } },
      _count: { select: { items: true } },
      payments: { where: { voided: false }, select: { method: true, tip: true } },
    },
    orderBy: { closedAt: "desc" },
    take: LIMIT + 1,
  });

  const truncated = rows.length > LIMIT;
  const data = rows.slice(0, LIMIT).map((c) => ({
    id: c.id, folio: c.folio, closedAt: c.closedAt?.toISOString() ?? null, shift: c.shift,
    total: round(Number(c.total)), guests: c.guestsActual,
    table: c.table ? `Mesa ${c.table.number}` : (c.customName ?? "—"),
    section: c.table?.section?.name ?? (c.customName ? "Sin mesa" : "—"),
    waiter: c.waiter?.fullName ?? "—",
    items: c._count.items,
    tip: round(c.payments.reduce((s, p) => s + Number(p.tip), 0)),
    methods: [...new Set(c.payments.map((p) => p.method))],
  }));

  const salesTotal = round(data.reduce((s, r) => s + r.total, 0));
  return NextResponse.json<ApiResponse>({ success: true, data: { rows: data, truncated, count: data.length, salesTotal, label } });
}
