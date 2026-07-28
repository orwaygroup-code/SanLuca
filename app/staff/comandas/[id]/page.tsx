"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import {
  C, StaffHeader, Spinner, EmptyState, Badge, ConfirmModal, ReasonModal,
  TicketPreview, btn, formatMXN, STATUS_LABEL, STATUS_COLOR, useToasts, ToastHost, useStaffLogout,
} from "@/components/staff/ui";
import { apiFetch, type Comanda, type CItem, type PayResult, type CashSession, type CutSnapshot } from "@/components/staff/types";
import { SplitBillModal } from "@/components/staff/SplitBillModal";
import { PayModal, DiscountModal, MergeModal, TransferItemModal, ReopenModal } from "@/components/staff/caja";
import { MenuSelector } from "@/components/staff/MenuSelector";
import { buildTotalLines } from "@/lib/displayTotals";
import { buildSplitsPayload, effectiveTaxRate, divisionMoney, unitsSubtotal } from "@/lib/splitBill";


const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: "Por enviar", SENT: "En cocina", READY: "Listo", SERVED: "Servido", CANCELLED: "Cancelado",
};
const ITEM_STATUS_COLOR: Record<string, string> = {
  PENDING: C.amber, SENT: C.blue, READY: C.green, SERVED: C.dim, CANCELLED: C.red,
};

/** Formatea cantidad decimal para mostrar: 0.5, 1.5, 2 (sin ruido de float). */
const fmtQty = (q: number) => String(Math.round(q * 100) / 100);

/** Etiqueta de "tiempo" (curso): 1 → "1er tiempo", 2 → "2do tiempo"… */
const COURSE_ORD = ["", "1er", "2do", "3er", "4to", "5to", "6to", "7mo", "8vo", "9no", "10mo"];
const courseLabel = (n: number) => `${COURSE_ORD[n] ?? `${n}º`} tiempo`;

export default function ComandaDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const { toasts, push, dismiss } = useToasts();

  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [cancelItem, setCancelItem] = useState<CItem | null>(null);
  const [askBill, setAskBill] = useState(false);
  const [reprint, setReprint] = useState(false);
  const [clearAsk, setClearAsk] = useState(false);
  const [currentCourse, setCurrentCourse] = useState(1); // "tiempo" al que se agregan nuevos platillos

  // ── caja ──
  const [payOpen, setPayOpen] = useState(false);
  const [discountTarget, setDiscountTarget] = useState<{ itemId?: number; itemName?: string } | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // División de cuenta: cada entrada (División 1..N) es un Map itemId → unidades
  // asignadas a esa división. Permite repartir fracciones de un mismo platillo.
  const [splits, setSplits] = useState<Map<number, number>[]>([]);
  const [splitOpen, setSplitOpen] = useState(false);

  const isSupervisor = staff?.role === "CAPTAIN" || staff?.role === "MANAGER";

  // back del detalle respeta el realm del staff: OPERATION vuelve a su mapa,
  // CAPTAIN a su panel; WAITER (y default) a la lista de comandas.
  const backHref =
    staff?.role === "OPERATION" ? "/staff/operacion"
    : staff?.role === "CAPTAIN" ? "/staff/capitan"
    : "/staff/comandas";

  const refresh = useCallback(async () => {
    const r = await apiFetch<Comanda>(`/api/comandas/${id}`);
    if (r.ok) setComanda(r.data!);
    else if (r.status === 404 || r.status === 403) setNotFound(true);
    else push(r.error ?? "No se pudo cargar", "error");
  }, [id, push]);

  useEffect(() => {
    if (!loading && !staff) { router.replace(`/staff/login?next=/staff/comandas/${id}`); return; }
    if (staff) {
      refresh();
      apiFetch<{ taxEnabled: boolean }>("/api/admin/settings").then((r) => { if (r.ok) setTaxEnabled(r.data!.taxEnabled); });
      if (staff.role !== "WAITER") {
        apiFetch<{ session: CashSession | null; cut: CutSnapshot | null }>("/api/caja/sessions/current")
          .then((r) => { if (r.ok) setHasSession(!!r.data!.session); });
      }
    }
  }, [loading, staff, id, router, refresh]);

  const liveItems = useMemo(() => (comanda?.items ?? []).filter((i) => i.status !== "CANCELLED"), [comanda]);
  const pendingCount = useMemo(() => liveItems.filter((i) => i.status === "PENDING").length, [liveItems]);
  const alreadyPrinted = useMemo(() => (comanda?.prints ?? []).some((p) => p.type === "CUSTOMER_FINAL"), [comanda]);
  const editable = comanda?.status === "OPEN" || comanda?.status === "IN_SERVICE";

  // ── división de cuenta (derivados) ──
  const itemById = useMemo(() => new Map(liveItems.map((i) => [i.id, i])), [liveItems]);
  const unitPriceById = useMemo(() => new Map(liveItems.map((i) => [i.id, Number(i.unitPriceSnapshot)])), [liveItems]);
  const totalLiveUnits = useMemo(() => liveItems.reduce((s, i) => s + Number(i.quantity), 0), [liveItems]);
  // ¿Alguna línea tiene cantidad fraccional? Si sí, la división POR UNIDAD se desactiva
  // (las líneas fraccionales van completas a un ticket, no se subdividen).
  const hasFractional = useMemo(() => liveItems.some((i) => !Number.isInteger(Number(i.quantity))), [liveItems]);

  // "Tiempo actual" se mantiene al día con el máximo existente (nunca lo baja).
  useEffect(() => {
    const mc = liveItems.reduce((m, i) => Math.max(m, i.course || 1), 1);
    setCurrentCourse((prev) => Math.max(prev, mc));
  }, [liveItems]);

  // Unidades ya asignadas (a cualquier división), por itemId.
  const assignedQtyById = useMemo(() => {
    const m = new Map<number, number>();
    for (const split of splits) for (const [itemId, q] of split) m.set(itemId, (m.get(itemId) ?? 0) + q);
    return m;
  }, [splits]);

  // Items con unidades aún disponibles en la matriz (no asignadas a ninguna división).
  const matrixItemsWithQty = useMemo(() =>
    liveItems
      .map((it) => ({ ...it, remainingQty: Number(it.quantity) - (assignedQtyById.get(it.id) ?? 0) }))
      .filter((it) => it.remainingQty > 0),
    [liveItems, assignedQtyById]);

  const canSplit = (editable ?? false) && !alreadyPrinted && !hasFractional;

  // Mantener las divisiones consistentes con los items vivos: si un item se
  // cancela se quita de sus divisiones; si una cantidad asignada excede la
  // ordenada actual se recorta; las divisiones que quedan vacías se descartan.
  // (Items nuevos no entran a ninguna división → caen a la matriz con qty completa.)
  useEffect(() => {
    const maxById = new Map(liveItems.map((i) => [i.id, Number(i.quantity)]));
    setSplits((prev) => {
      let changed = false;
      const pruned: Map<number, number>[] = [];
      for (const split of prev) {
        const next = new Map<number, number>();
        for (const [itemId, q] of split) {
          const max = maxById.get(itemId);
          if (max === undefined) { changed = true; continue; }       // item cancelado
          const clamped = Math.min(q, max);
          if (clamped !== q) changed = true;                          // qty recortada
          if (clamped > 0) next.set(itemId, clamped);
        }
        if (next.size > 0) pruned.push(next); else changed = true;    // división vacía
      }
      return changed ? pruned : prev;
    });
  }, [liveItems]);

  const createSplit = (units: Map<number, number>) => {
    if (units.size > 0) setSplits((s) => [...s, units]);
    setSplitOpen(false);
  };
  const removeSplit = (idx: number) => setSplits((s) => s.filter((_, i) => i !== idx));

  // ── acciones ──
  const post = useCallback(async (path: string, body?: unknown, okMsg?: string) => {
    setBusy(true);
    const r = await apiFetch<Comanda>(path, {
      method: body === undefined ? "POST" : "POST",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (r.ok) { setComanda(r.data!); if (okMsg) push(okMsg, "success"); return true; }
    push(r.error ?? "Error", "error");
    return false;
  }, [push]);

  const sendToKitchen = () => post(`/api/comandas/${id}/send-to-kitchen`, undefined, "Enviado a cocina/barra");
  const doPrint = (authorizationReason?: string) => {
    const matrixUnits = matrixItemsWithQty.map((it) => ({ itemId: it.id, quantity: it.remainingQty }));
    const splitsPayload = buildSplitsPayload(splits, matrixUnits);
    const body: Record<string, unknown> = {};
    if (splitsPayload) body.splits = splitsPayload;
    if (authorizationReason) body.authorizationReason = authorizationReason;
    return post(`/api/comandas/${id}/print`, body, "Ticket impreso");
  };
  const requestBill = async () => { setAskBill(false); await post(`/api/comandas/${id}/send-to-cashier`, undefined, "Cuenta solicitada"); };

  const confirmCancelItem = async (reason?: string) => {
    if (!cancelItem) return;
    setBusy(true);
    const r = await apiFetch<Comanda>(`/api/comandas/${id}/items/${cancelItem.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    });
    setBusy(false);
    setCancelItem(null);
    if (r.ok) { setComanda(r.data!); push("Item cancelado", "success"); }
    else push(r.error ?? "No se pudo cancelar", "error");
  };

  // Vaciar borrador: borra TODOS los platillos aún no enviados (status PENDING).
  const clearDraft = async () => {
    setClearAsk(false);
    const pend = liveItems.filter((i) => i.status === "PENDING");
    if (pend.length === 0) return;
    setBusy(true);
    for (const it of pend) {
      await apiFetch(`/api/comandas/${id}/items/${it.id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
    }
    setBusy(false);
    await refresh();
    push("Borrador vaciado", "success");
  };

  if (loading || (!comanda && !notFound)) return <div style={page.root}><Spinner /></div>;

  if (notFound) {
    return (
      <div style={page.root}>
        <StaffHeader title="Comanda" role={staff?.role} userName={staff?.fullName} onLogout={logout} onBack={() => router.push(backHref)} />
        <main style={page.main}><EmptyState text="Comanda no encontrada o no es tuya." /></main>
      </div>
    );
  }

  const c = comanda!;
  const canCancel = (it: CItem) => it.status === "PENDING" || isSupervisor;
  const totalLines = buildTotalLines(c, taxEnabled);

  // Caja: OPERATION/CAPTAIN/MANAGER operan la cuenta; WAITER solo captura.
  const isCashier = staff?.role === "OPERATION" || staff?.role === "CAPTAIN" || staff?.role === "MANAGER";
  const cajaActive = ["OPEN", "IN_SERVICE", "AWAITING_PAYMENT", "PARTIALLY_PAID"].includes(c.status);
  const isPaid = c.status === "PAID";
  const amountPaid = Number(c.amountPaid);
  const remaining = Math.max(0, Math.round((Number(c.total) - amountPaid) * 100) / 100);

  // ── render de división de cuenta ──
  const rate = effectiveTaxRate(c);
  const unitsOf = (split: Map<number, number>) => [...split.entries()].map(([itemId, quantity]) => ({ itemId, quantity }));
  const unitName = (itemId: number) => itemById.get(itemId)?.dishNameSnapshot ?? `#${itemId}`;
  const unitsToTicketItems = (units: { itemId: number; quantity: number }[]) =>
    units.map((u) => ({ name: unitName(u.itemId), qty: u.quantity, total: (unitPriceById.get(u.itemId) ?? 0) * u.quantity }));

  // Fila completa (vista sin divisiones): status, modificadores y cancelar item.
  const renderItemRow = (it: CItem) => (
    <div key={it.id} style={page.itemRow}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: C.cream, fontSize: "0.92rem", fontWeight: 600 }}>
          {fmtQty(Number(it.quantity))}× {it.dishNameSnapshot}
        </div>
        {(it.modifiers || it.kitchenNotes) && (
          <div style={{ color: C.faint, fontSize: "0.74rem", marginTop: 2 }}>
            {[it.modifiers, it.kitchenNotes].filter(Boolean).join(" · ")}
          </div>
        )}
        <div style={{ marginTop: 4 }}>
          <Badge text={ITEM_STATUS_LABEL[it.status] ?? it.status} color={ITEM_STATUS_COLOR[it.status] ?? C.dim} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ textAlign: "right" }}>
          <span style={{ color: C.cream, fontWeight: 700, fontSize: "0.9rem" }}>{formatMXN(Number(it.lineTotal) - Number(it.discountAmount))}</span>
          {Number(it.discountAmount) > 0 && (
            <div style={{ color: C.gold, fontSize: "0.68rem" }}>−{formatMXN(Number(it.discountAmount))} desc.</div>
          )}
        </div>
        {isCashier && cajaActive && (
          <button style={page.discBtn} title="Descuento a este producto" onClick={() => setDiscountTarget({ itemId: it.id, itemName: it.dishNameSnapshot })}>%</button>
        )}
        {editable && canCancel(it) && (
          <button style={page.cancelX} title="Cancelar item" onClick={() => setCancelItem(it)}>×</button>
        )}
      </div>
    </div>
  );

  // Fila simple por unidad (matriz/divisiones): {qty}× nombre + subtotal por unidad.
  const renderUnitRow = (key: string, name: string, qty: number, subtotal: number) => (
    <div key={key} style={page.itemRow}>
      <div style={{ color: C.cream, fontSize: "0.9rem", fontWeight: 600 }}>{qty}× {name}</div>
      <span style={{ color: C.cream, fontWeight: 700, fontSize: "0.88rem" }}>{formatMXN(subtotal)}</span>
    </div>
  );

  // Secciones del preview: una por división + la matriz residual como ticket
  // final (si tiene unidades), reflejando exactamente lo que se imprimirá.
  const matrixUnits = matrixItemsWithQty.map((it) => ({ itemId: it.id, quantity: it.remainingQty }));
  const previewSplits = splits.length > 0
    ? [
        ...splits.map((split, idx) => {
          const units = unitsOf(split);
          return { title: `Ticket ${idx + 1}`, items: unitsToTicketItems(units), money: divisionMoney(unitsSubtotal(units, unitPriceById), rate, taxEnabled) };
        }),
        ...(matrixUnits.length > 0
          ? [{ title: `Ticket ${splits.length + 1}`, items: unitsToTicketItems(matrixUnits), money: divisionMoney(unitsSubtotal(matrixUnits, unitPriceById), rate, taxEnabled) }]
          : []),
      ]
    : undefined;

  return (
    <div style={page.root}>
      <StaffHeader
        title={c.folio}
        role={staff?.role}
        userName={staff?.fullName}
        onLogout={logout}
        onBack={() => router.push(backHref)}
        right={<Badge text={STATUS_LABEL[c.status] ?? c.status} color={STATUS_COLOR[c.status] ?? C.dim} />}
      />

      <main style={page.main}>
        <div style={page.head}>
          <div>
            <div style={{ color: C.cream, fontSize: "1.2rem", fontWeight: 800 }}>Mesa {c.table.number} · {c.table.section.name}</div>
            <div style={{ color: C.dim, fontSize: "0.84rem", marginTop: 2 }}>{c.guestsActual} comensales · mesero {c.waiter.fullName}</div>
          </div>
        </div>

        {/* Items */}
        <section style={page.panel}>
          <div style={page.panelHead}>Platillos</div>
          {liveItems.length === 0 ? (
            <EmptyState text="Sin platillos. Agrega del menú." />
          ) : splits.length === 0 ? (
            <div>
              {[...new Set(liveItems.map((i) => i.course))].sort((a, b) => a - b).map((cn, _i, arr) => (
                <div key={cn}>
                  {arr.length > 1 && <div style={page.courseSep}>{courseLabel(cn)}</div>}
                  {liveItems.filter((i) => i.course === cn).map(renderItemRow)}
                </div>
              ))}
            </div>
          ) : (
            <div>
              {/* Matriz (cuenta principal): unidades aún sin dividir */}
              <div style={page.splitHead}>
                <span style={{ color: C.dim }}>Cuenta principal (matriz)</span>
                <span style={{ color: C.cream, fontWeight: 700 }}>{formatMXN(unitsSubtotal(matrixUnits, unitPriceById))}</span>
              </div>
              {matrixItemsWithQty.length === 0 ? (
                <div style={page.splitEmpty}>Todas las unidades están divididas.</div>
              ) : matrixItemsWithQty.map((it) =>
                renderUnitRow(`m-${it.id}`, it.dishNameSnapshot, it.remainingQty, Number(it.unitPriceSnapshot) * it.remainingQty),
              )}

              {/* Divisiones creadas */}
              {splits.map((split, idx) => {
                const units = unitsOf(split);
                return (
                  <div key={idx}>
                    <div style={{ ...page.splitHead, ...page.splitHeadDivision }}>
                      <span style={{ color: C.gold, fontWeight: 700 }}>División {idx + 1}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ color: C.cream, fontWeight: 700 }}>{formatMXN(unitsSubtotal(units, unitPriceById))}</span>
                        {canSplit && (
                          <button style={page.splitRemove} onClick={() => removeSplit(idx)}>Eliminar</button>
                        )}
                      </span>
                    </div>
                    {units.map((u) =>
                      renderUnitRow(`d${idx}-${u.itemId}`, unitName(u.itemId), u.quantity, (unitPriceById.get(u.itemId) ?? 0) * u.quantity),
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Totales */}
        <section style={{ ...page.panel, padding: "14px 18px" }}>
          {totalLines.map((l) => (
            <div key={l.label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: l.strong ? C.cream : C.dim, fontWeight: l.strong ? 800 : 500, fontSize: l.strong ? "1.1rem" : "0.86rem" }}>
              <span>{l.label}</span><span>{formatMXN(l.amount)}</span>
            </div>
          ))}
        </section>

        {/* Acciones */}
        <section style={page.actions}>
          {editable && (
            <button style={btn.ghost} onClick={() => setMenuOpen(true)} disabled={busy}>+ Agregar platillos ({courseLabel(currentCourse)})</button>
          )}
          {editable && (
            <button style={btn.ghost} onClick={() => setCurrentCourse((prev) => prev + 1)} disabled={busy}>＋ Nuevo tiempo</button>
          )}
          {editable && pendingCount > 0 && (
            <button style={btn.primary} onClick={sendToKitchen} disabled={busy}>Enviar a cocina ({pendingCount})</button>
          )}
          {editable && pendingCount > 0 && (
            <button style={btn.ghost} onClick={() => setClearAsk(true)} disabled={busy}>Vaciar ({pendingCount})</button>
          )}
          {editable && (
            <button style={btn.ghost} onClick={() => setAskBill(true)} disabled={busy || liveItems.length === 0}>Pedir cuenta</button>
          )}
          {canSplit && totalLiveUnits > 1 && (
            <button style={btn.ghost} onClick={() => setSplitOpen(true)} disabled={busy || matrixItemsWithQty.length === 0}>
              {splits.length === 0 ? "Dividir cuenta" : "Dividir otra cuenta"}
            </button>
          )}
          {!alreadyPrinted ? (
            <button style={btn.primary} onClick={() => doPrint()} disabled={busy || liveItems.length === 0}>Imprimir cuenta</button>
          ) : isSupervisor ? (
            <button style={btn.ghost} onClick={() => setReprint(true)} disabled={busy}>Reimprimir (autorizado)</button>
          ) : (
            <span style={{ color: C.faint, fontSize: "0.76rem", alignSelf: "center" }}>Ticket ya impreso · reimpresión la autoriza Capitán</span>
          )}
        </section>

        {/* Acciones de CAJA (OPERATION/CAPTAIN/MANAGER). Las sensibles piden PIN. */}
        {isCashier && (cajaActive || isPaid) && (
          <section style={{ ...page.actions, marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
            {cajaActive && (
              <button style={btn.primary} onClick={() => setPayOpen(true)} disabled={busy}>
                Cobrar{amountPaid > 0 ? ` · restan ${formatMXN(remaining)}` : ""}
              </button>
            )}
            {cajaActive && (
              <button style={btn.ghost} onClick={() => setDiscountTarget({})} disabled={busy || liveItems.length === 0}>Descuento a la cuenta</button>
            )}
            {cajaActive && (
              <button style={btn.ghost} onClick={() => setMergeOpen(true)} disabled={busy}>Juntar cuentas</button>
            )}
            {cajaActive && (
              <button style={btn.ghost} onClick={() => setTransferOpen(true)} disabled={busy || liveItems.length === 0}>Traspasar producto</button>
            )}
            {isPaid && (
              <button style={btn.ghost} onClick={() => setReopenOpen(true)} disabled={busy}>Reabrir cuenta</button>
            )}
          </section>
        )}

        {(c.status === "AWAITING_PAYMENT" || alreadyPrinted || splits.length > 0) && (
          <section style={{ marginTop: 18 }}>
            <TicketPreview
              folio={c.folio}
              table={`Mesa ${c.table.number}`}
              money={c}
              taxEnabled={taxEnabled}
              items={previewSplits ? undefined : liveItems.map((i) => ({ name: i.dishNameSnapshot, qty: Number(i.quantity), total: Number(i.lineTotal) }))}
              splits={previewSplits}
              footer="¡Gracias por su visita!"
            />
          </section>
        )}
      </main>

      {/* Menú para agregar (pantalla completa) */}
      <MenuSelector
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onAdd={async (dishId, quantity, modifiers, kitchenNotes) => {
          const ok = await post(`/api/comandas/${id}/items`, { dishId, quantity, modifiers, kitchenNotes, course: currentCourse }, "Platillo agregado");
          return ok;
        }}
        busy={busy}
      />

      {/* Cancelar item */}
      {cancelItem && cancelItem.status === "PENDING" && (
        <ConfirmModal
          open
          title="Cancelar platillo"
          message={`¿Quitar «${fmtQty(Number(cancelItem.quantity))}× ${cancelItem.dishNameSnapshot}»? Aún no se ha enviado a cocina.`}
          confirmLabel="Quitar"
          danger
          busy={busy}
          onConfirm={() => confirmCancelItem()}
          onCancel={() => setCancelItem(null)}
        />
      )}
      {cancelItem && cancelItem.status !== "PENDING" && (
        <ReasonModal
          open
          title="Cancelar platillo enviado"
          label="Motivo de la cancelación (auditoría)"
          confirmLabel="Cancelar platillo"
          danger
          busy={busy}
          onConfirm={(reason) => confirmCancelItem(reason)}
          onCancel={() => setCancelItem(null)}
        />
      )}

      <ConfirmModal
        open={askBill}
        title="Pedir la cuenta"
        message="La comanda pasará a «Por cobrar». Ya no podrás agregar platillos. ¿Continuar?"
        confirmLabel="Pedir cuenta"
        busy={busy}
        onConfirm={requestBill}
        onCancel={() => setAskBill(false)}
      />

      <ReasonModal
        open={reprint}
        title="Reimprimir ticket"
        label="Motivo de la reimpresión (auditoría)"
        confirmLabel="Reimprimir"
        busy={busy}
        onConfirm={async (reason) => { setReprint(false); await doPrint(reason); }}
        onCancel={() => setReprint(false)}
      />

      <SplitBillModal
        open={splitOpen}
        divisionNumber={splits.length + 1}
        items={matrixItemsWithQty.map((it) => ({ id: it.id, name: it.dishNameSnapshot, unitPrice: Number(it.unitPriceSnapshot), remainingQty: it.remainingQty }))}
        busy={busy}
        onConfirm={createSplit}
        onClose={() => setSplitOpen(false)}
      />

      {/* ── Modales de CAJA ── */}
      <PayModal
        open={payOpen}
        comandaId={payOpen ? c.id : null}
        hasOpenSession={hasSession}
        onClose={() => setPayOpen(false)}
        onPaid={(r: PayResult) => {
          setPayOpen(false); setComanda(r.comanda);
          push(r.settled ? "Cuenta cobrada y cerrada" : `Abono registrado · restan ${formatMXN(r.remaining)}`, "success");
          if (r.changeGiven > 0) push(`Cambio a entregar: ${formatMXN(r.changeGiven)}`, "info");
        }}
        onError={(m) => push(m, "error")}
      />

      <DiscountModal
        open={discountTarget !== null}
        comandaId={c.id}
        itemId={discountTarget?.itemId ?? null}
        itemName={discountTarget?.itemName}
        onClose={() => setDiscountTarget(null)}
        onDone={(cc) => { setDiscountTarget(null); setComanda(cc); push("Descuento aplicado", "success"); }}
        onError={(m) => push(m, "error")}
      />

      <MergeModal
        open={mergeOpen}
        target={c}
        onClose={() => setMergeOpen(false)}
        onDone={(cc) => { setMergeOpen(false); setComanda(cc); push("Cuentas juntadas", "success"); }}
        onError={(m) => push(m, "error")}
      />

      <TransferItemModal
        open={transferOpen}
        from={c}
        onClose={() => setTransferOpen(false)}
        onDone={(cc) => { setTransferOpen(false); setComanda(cc); push("Producto traspasado", "success"); }}
        onError={(m) => push(m, "error")}
      />

      <ReopenModal
        open={reopenOpen}
        comanda={c}
        onClose={() => setReopenOpen(false)}
        onDone={(cc) => { setReopenOpen(false); setComanda(cc); push("Cuenta reabierta", "success"); }}
        onError={(m) => push(m, "error")}
      />

      <ConfirmModal
        open={clearAsk}
        title="Vaciar borrador"
        message={`¿Borrar los ${pendingCount} platillo(s) por enviar? Aún no se mandan a cocina; esto no afecta lo ya enviado.`}
        confirmLabel="Vaciar"
        danger
        busy={busy}
        onConfirm={clearDraft}
        onCancel={() => setClearAsk(false)}
      />

      <ToastHost toasts={toasts} onClose={dismiss} />
    </div>
  );
}


const page: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: C.bg },
  main: { padding: "18px", maxWidth: 720, margin: "0 auto", paddingBottom: 60 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  panel: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 14 },
  panelHead: { padding: "12px 18px", borderBottom: `1px solid ${C.line}`, color: C.faint, fontSize: "0.66rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 },
  courseSep: { padding: "8px 18px", background: "rgba(186,132,60,0.08)", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.line}`, color: C.gold, fontSize: "0.68rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 },
  itemRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${C.line}` },
  cancelX: { width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.red}`, background: "transparent", color: C.red, fontSize: "1.1rem", cursor: "pointer", lineHeight: 1 },
  discBtn: { width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.gold}`, background: "transparent", color: C.gold, fontSize: "0.92rem", fontWeight: 700, cursor: "pointer", lineHeight: 1 },
  actions: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 },
  splitHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 18px", background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${C.line}`, fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 },
  splitHeadDivision: { background: "rgba(186,132,60,0.08)", borderTop: `1px solid ${C.border}` },
  splitEmpty: { padding: "14px 18px", color: C.faint, fontSize: "0.82rem", borderBottom: `1px solid ${C.line}` },
  splitRemove: { padding: "4px 10px", borderRadius: 7, border: `1px solid ${C.red}`, background: "transparent", color: C.red, fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
};
