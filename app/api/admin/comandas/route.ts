import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

const MX_TZ = "America/Mexico_City";
const DAY = 86_400_000;
const mxToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: MX_TZ }).format(new Date());

type AuditKind =
  | "PRINT" | "REPRINT" | "TABLE_CHANGE" | "WAITER_CHANGE" | "ITEM_CANCEL" | "ITEM_REMOVE"
  | "PAYMENT" | "PAYMENT_VOID" | "DISCOUNT" | "MERGE" | "TRANSFER" | "REOPEN";
interface AuditEvent { kind: AuditKind; at: string; actor: string; detail: string; reason: string | null }

const MXN = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;
const METHOD_LABEL: Record<string, string> = { CASH: "Efectivo", CARD_DEBIT: "Débito", CARD_CREDIT: "Crédito", TRANSFER: "Transferencia" };

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
      payments: { select: { method: true, amount: true, tip: true, voided: true, voidedReason: true, voidedAt: true, createdAt: true, receivedBy: { select: { fullName: true } }, voidedById: true } },
      discounts: { select: { scope: true, type: true, value: true, amount: true, reason: true, createdAt: true, authorizedBy: { select: { fullName: true } }, item: { select: { dishNameSnapshot: true } } } },
      reopens: { select: { reason: true, voidedPayments: true, reopenedAt: true, reopenedBy: { select: { fullName: true } } } },
    },
  });

  // MERGE y TRANSFER referencian comandas por scalar (sin back-relation) → query aparte.
  const ids = comandas.map((c) => c.id);
  const folioById = new Map(comandas.map((c) => [c.id, c.folio]));
  const [merges, transfers] = await Promise.all([
    prisma.comandaMerge.findMany({
      where: { tenantId: TENANT, OR: [{ targetComandaId: { in: ids } }, { sourceComandaId: { in: ids } }] },
      select: { sourceComandaId: true, targetComandaId: true, sourceFolio: true, itemCount: true, reason: true, mergedAt: true, mergedBy: { select: { fullName: true } } },
    }),
    prisma.comandaItemTransfer.findMany({
      where: { tenantId: TENANT, OR: [{ fromComandaId: { in: ids } }, { toComandaId: { in: ids } }] },
      select: { fromComandaId: true, toComandaId: true, dishNameSnapshot: true, quantity: true, reason: true, movedAt: true, movedBy: { select: { fullName: true } } },
    }),
  ]);
  const extraByComanda = new Map<number, AuditEvent[]>();
  const pushExtra = (cid: number, ev: AuditEvent) => {
    const arr = extraByComanda.get(cid) ?? [];
    arr.push(ev); extraByComanda.set(cid, arr);
  };
  for (const m of merges) {
    if (ids.includes(m.targetComandaId)) pushExtra(m.targetComandaId, { kind: "MERGE", at: m.mergedAt.toISOString(), actor: m.mergedBy.fullName, detail: `Juntó cuenta ${m.sourceFolio} (${m.itemCount} prod.)`, reason: m.reason });
    if (ids.includes(m.sourceComandaId)) pushExtra(m.sourceComandaId, { kind: "MERGE", at: m.mergedAt.toISOString(), actor: m.mergedBy.fullName, detail: `Cuenta juntada a ${folioById.get(m.targetComandaId) ?? "?"}`, reason: m.reason });
  }
  for (const t of transfers) {
    if (ids.includes(t.fromComandaId)) pushExtra(t.fromComandaId, { kind: "TRANSFER", at: t.movedAt.toISOString(), actor: t.movedBy.fullName, detail: `Traspasó ${t.quantity}× ${t.dishNameSnapshot} → ${folioById.get(t.toComandaId) ?? "?"}`, reason: t.reason });
    if (ids.includes(t.toComandaId)) pushExtra(t.toComandaId, { kind: "TRANSFER", at: t.movedAt.toISOString(), actor: t.movedBy.fullName, detail: `Recibió ${t.quantity}× ${t.dishNameSnapshot} ← ${folioById.get(t.fromComandaId) ?? "?"}`, reason: t.reason });
  }

  const data = comandas.map((c) => {
    const events: AuditEvent[] = [];
    for (const p of c.prints) {
      // Solo auditamos IMPRESIONES REALES de papel del cliente/cocina. Se ignoran:
      // KITCHEN_BAR (envío a cocina, ruido), DRAWER_KICK (abre el cajón, NO imprime),
      // KITCHEN_CANCEL (ya se ve como cancelación del producto), CORTE/TIP/MESSAGE.
      // Antes TODO lo que no fuera CUSTOMER_REPRINT se marcaba "Impresión de cuenta", así
      // que el pulso del cajón al cobrar aparecía como una impresión de más.
      if (p.type !== "CUSTOMER_FINAL" && p.type !== "CUSTOMER_REPRINT" && p.type !== "KITCHEN_REPRINT") continue;
      const reprint = p.type === "CUSTOMER_REPRINT";
      const kitchenReprint = p.type === "KITCHEN_REPRINT";
      events.push({
        kind: (reprint || kitchenReprint) ? "REPRINT" : "PRINT",
        at: p.printedAt.toISOString(),
        actor: reprint ? (p.authorizedBy?.fullName ?? p.executedBy.fullName) : p.executedBy.fullName,
        detail: kitchenReprint ? "Reimpresión a cocina" : reprint ? "Reimpresión de ticket" : "Impresión de cuenta",
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
      // Un retiro ANTES de cocina (mesero quita su propio producto PENDING) no lleva
      // motivo; una cancelación de producto YA enviado exige motivo (y la hace un
      // supervisor). Distinguirlos para que "quitó" no se vea como "canceló".
      const enviado = !!it.cancelledReason;
      events.push({
        kind: enviado ? "ITEM_CANCEL" : "ITEM_REMOVE",
        at: (it.cancelledAt ?? c.openedAt).toISOString(),
        actor: sName(it.cancelledById),
        detail: enviado
          ? `Canceló ${it.quantity}× ${it.dishNameSnapshot} (enviado a cocina)`
          : `Quitó ${it.quantity}× ${it.dishNameSnapshot} (antes de cocina)`,
        reason: it.cancelledReason,
      });
    }
    for (const p of c.payments) {
      if (p.voided) {
        events.push({ kind: "PAYMENT_VOID", at: (p.voidedAt ?? p.createdAt).toISOString(), actor: sName(p.voidedById), detail: `Anuló pago ${MXN(Number(p.amount))} (${METHOD_LABEL[p.method] ?? p.method})`, reason: p.voidedReason });
      } else {
        const tip = Number(p.tip) > 0 ? ` + propina ${MXN(Number(p.tip))}` : "";
        events.push({ kind: "PAYMENT", at: p.createdAt.toISOString(), actor: p.receivedBy.fullName, detail: `Cobró ${MXN(Number(p.amount))} (${METHOD_LABEL[p.method] ?? p.method})${tip}`, reason: null });
      }
    }
    for (const d of c.discounts) {
      const scope = d.scope === "ITEM" ? `producto${d.item ? ` (${d.item.dishNameSnapshot})` : ""}` : "cuenta";
      const val = d.type === "PERCENT" ? `${Number(d.value)}%` : MXN(Number(d.value));
      events.push({ kind: "DISCOUNT", at: d.createdAt.toISOString(), actor: d.authorizedBy.fullName, detail: `Descuento a ${scope}: ${val} (−${MXN(Number(d.amount))})`, reason: d.reason });
    }
    for (const r of c.reopens) {
      events.push({ kind: "REOPEN", at: r.reopenedAt.toISOString(), actor: r.reopenedBy.fullName, detail: r.voidedPayments ? "Reabrió cuenta (anuló pagos)" : "Reabrió cuenta (conservó pagos)", reason: r.reason });
    }
    events.push(...(extraByComanda.get(c.id) ?? []));
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
