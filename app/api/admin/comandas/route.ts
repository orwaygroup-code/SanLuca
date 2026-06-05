import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

const MX_TZ = "America/Mexico_City";
const DAY = 86_400_000;
const mxToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: MX_TZ }).format(new Date());

interface AuditEvent { kind: "PRINT" | "REPRINT" | "TABLE_CHANGE" | "WAITER_CHANGE" | "ITEM_CANCEL"; at: string; actor: string; detail: string; reason: string | null }

/**
 * GET /api/admin/comandas?range=today|7d|30d — auditoría de comandas para Ricardo.
 * Por cada comanda devuelve sus eventos (impresiones, reimpresiones, cambios de
 * mesa/mesero, items cancelados) con el responsable resuelto. Solo ADMIN.
 */
export async function GET(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const range = new URL(request.url).searchParams.get("range") ?? "today";
  const days = range === "30d" ? 30 : range === "7d" ? 7 : 1;
  const todayStart = new Date(`${mxToday()}T00:00:00.000-06:00`);
  const from = new Date(todayStart.getTime() - (days - 1) * DAY);

  // Mapas de resolución (scalars de auditoría → nombre legible). Tablas pequeñas.
  const [staffRows, tableRows] = await Promise.all([
    prisma.staff.findMany({ where: { tenantId: TENANT }, select: { id: true, fullName: true } }),
    prisma.table.findMany({ select: { id: true, number: true } }),
  ]);
  const staffName = new Map(staffRows.map((s) => [s.id, s.fullName]));
  const tableNo = new Map(tableRows.map((t) => [t.id, t.number]));
  const sName = (id: number | null | undefined) => (id != null ? staffName.get(id) ?? `#${id}` : "—");
  const tName = (id: string) => (tableNo.has(id) ? `Mesa ${tableNo.get(id)}` : id);

  const comandas = await prisma.comanda.findMany({
    where: { tenantId: TENANT, openedAt: { gte: from } },
    orderBy: { openedAt: "desc" },
    select: {
      id: true, folio: true, status: true, total: true, openedAt: true, closedAt: true,
      guestsActual: true, cancellationReason: true, cancelledById: true, cancelledAt: true,
      table: { select: { number: true, section: { select: { name: true } } } },
      waiter: { select: { fullName: true } },
      prints: { select: { type: true, printedAt: true, authorizationReason: true, executedBy: { select: { fullName: true } }, authorizedBy: { select: { fullName: true } } } },
      tableChanges: { select: { fromTableId: true, toTableId: true, reason: true, changedAt: true, changedBy: { select: { fullName: true } } } },
      waiterChanges: { select: { fromWaiterId: true, toWaiterId: true, reason: true, changedAt: true, changedBy: { select: { fullName: true } } } },
      items: { where: { status: "CANCELLED" }, select: { dishNameSnapshot: true, quantity: true, cancelledReason: true, cancelledById: true, cancelledAt: true } },
    },
  });

  const data = comandas.map((c) => {
    const events: AuditEvent[] = [];
    for (const p of c.prints) {
      const reprint = p.type === "CUSTOMER_REPRINT";
      if (p.type === "KITCHEN_BAR") continue; // ruido de cocina; auditamos tickets de cliente
      events.push({
        kind: reprint ? "REPRINT" : "PRINT",
        at: p.printedAt.toISOString(),
        actor: reprint ? (p.authorizedBy?.fullName ?? p.executedBy.fullName) : p.executedBy.fullName,
        detail: reprint ? "Reimpresión de ticket" : "Impresión de cuenta",
        reason: p.authorizationReason ?? null,
      });
    }
    for (const t of c.tableChanges) {
      events.push({ kind: "TABLE_CHANGE", at: t.changedAt.toISOString(), actor: t.changedBy.fullName, detail: `${tName(t.fromTableId)} → ${tName(t.toTableId)}`, reason: t.reason });
    }
    for (const w of c.waiterChanges) {
      events.push({ kind: "WAITER_CHANGE", at: w.changedAt.toISOString(), actor: w.changedBy.fullName, detail: `${sName(w.fromWaiterId)} → ${sName(w.toWaiterId)}`, reason: w.reason });
    }
    for (const it of c.items) {
      events.push({ kind: "ITEM_CANCEL", at: (it.cancelledAt ?? c.openedAt).toISOString(), actor: sName(it.cancelledById), detail: `Canceló ${it.quantity}× ${it.dishNameSnapshot}`, reason: it.cancelledReason });
    }
    events.sort((x, y) => (x.at < y.at ? 1 : -1));

    return {
      id: c.id, folio: c.folio, status: c.status, total: Number(c.total),
      table: c.table ? `Mesa ${c.table.number} · ${c.table.section.name}` : "—",
      waiter: c.waiter?.fullName ?? "—",
      guests: c.guestsActual,
      openedAt: c.openedAt.toISOString(),
      closedAt: c.closedAt?.toISOString() ?? null,
      cancellation: c.status === "CANCELLED" ? { by: sName(c.cancelledById), reason: c.cancellationReason, at: c.cancelledAt?.toISOString() ?? null } : null,
      events,
    };
  });

  return NextResponse.json<ApiResponse>({ success: true, data });
}
