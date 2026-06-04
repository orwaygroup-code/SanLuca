"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import {
  C, StaffHeader, Spinner, EmptyState, Badge, Modal, ConfirmModal, ReasonModal,
  TicketPreview, btn, fld, formatMXN, STATUS_LABEL, STATUS_COLOR, useToasts, ToastHost, useStaffLogout,
} from "@/components/staff/ui";
import { apiFetch, type Comanda, type CItem } from "@/components/staff/types";
import { buildTotalLines } from "@/lib/displayTotals";

interface MenuDish { id: string; name: string; price: number; description: string | null }
interface MenuCat { id: string; name: string; dishes: MenuDish[] }

const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: "Por enviar", SENT: "En cocina", READY: "Listo", SERVED: "Servido", CANCELLED: "Cancelado",
};
const ITEM_STATUS_COLOR: Record<string, string> = {
  PENDING: C.amber, SENT: C.blue, READY: C.green, SERVED: C.dim, CANCELLED: C.red,
};

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

  const isSupervisor = staff?.role === "CAPTAIN" || staff?.role === "MANAGER";

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
    }
  }, [loading, staff, id, router, refresh]);

  const liveItems = useMemo(() => (comanda?.items ?? []).filter((i) => i.status !== "CANCELLED"), [comanda]);
  const pendingCount = useMemo(() => liveItems.filter((i) => i.status === "PENDING").length, [liveItems]);
  const alreadyPrinted = useMemo(() => (comanda?.prints ?? []).some((p) => p.type === "CUSTOMER_FINAL"), [comanda]);
  const editable = comanda?.status === "OPEN" || comanda?.status === "IN_SERVICE";

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
  const doPrint = (authorizationReason?: string) =>
    post(`/api/comandas/${id}/print`, authorizationReason ? { authorizationReason } : {}, "Ticket impreso");
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

  if (loading || (!comanda && !notFound)) return <div style={page.root}><Spinner /></div>;

  if (notFound) {
    return (
      <div style={page.root}>
        <StaffHeader title="Comanda" role={staff?.role} userName={staff?.fullName} onLogout={logout} onBack={() => router.push("/staff/comandas")} />
        <main style={page.main}><EmptyState text="Comanda no encontrada o no es tuya." /></main>
      </div>
    );
  }

  const c = comanda!;
  const canCancel = (it: CItem) => it.status === "PENDING" || isSupervisor;
  const totalLines = buildTotalLines(c, taxEnabled);

  return (
    <div style={page.root}>
      <StaffHeader
        title={c.folio}
        role={staff?.role}
        userName={staff?.fullName}
        onLogout={logout}
        onBack={() => router.push("/staff/comandas")}
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
          ) : (
            <div>
              {liveItems.map((it) => (
                <div key={it.id} style={page.itemRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: C.cream, fontSize: "0.92rem", fontWeight: 600 }}>
                      {it.quantity}× {it.dishNameSnapshot}
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
                    <span style={{ color: C.cream, fontWeight: 700, fontSize: "0.9rem" }}>{formatMXN(Number(it.lineTotal))}</span>
                    {editable && canCancel(it) && (
                      <button style={page.cancelX} title="Cancelar item" onClick={() => setCancelItem(it)}>×</button>
                    )}
                  </div>
                </div>
              ))}
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
            <button style={btn.ghost} onClick={() => setMenuOpen(true)} disabled={busy}>+ Agregar platillos</button>
          )}
          {editable && pendingCount > 0 && (
            <button style={btn.primary} onClick={sendToKitchen} disabled={busy}>Enviar a cocina ({pendingCount})</button>
          )}
          {editable && (
            <button style={btn.ghost} onClick={() => setAskBill(true)} disabled={busy || liveItems.length === 0}>Pedir cuenta</button>
          )}
          {!alreadyPrinted ? (
            <button style={btn.primary} onClick={() => doPrint()} disabled={busy || liveItems.length === 0}>Imprimir cuenta</button>
          ) : isSupervisor ? (
            <button style={btn.ghost} onClick={() => setReprint(true)} disabled={busy}>Reimprimir (autorizado)</button>
          ) : (
            <span style={{ color: C.faint, fontSize: "0.76rem", alignSelf: "center" }}>Ticket ya impreso · reimpresión la autoriza Capitán</span>
          )}
        </section>

        {(c.status === "AWAITING_PAYMENT" || alreadyPrinted) && (
          <section style={{ marginTop: 18 }}>
            <TicketPreview
              folio={c.folio}
              table={`Mesa ${c.table.number}`}
              money={c}
              taxEnabled={taxEnabled}
              items={liveItems.map((i) => ({ name: i.dishNameSnapshot, qty: i.quantity, total: Number(i.lineTotal) }))}
              footer="¡Gracias por su visita!"
            />
          </section>
        )}
      </main>

      {/* Menú para agregar */}
      <MenuModal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onAdd={async (dishId, quantity, modifiers, kitchenNotes) => {
          const ok = await post(`/api/comandas/${id}/items`, { dishId, quantity, modifiers, kitchenNotes }, "Platillo agregado");
          return ok;
        }}
        busy={busy}
      />

      {/* Cancelar item */}
      {cancelItem && cancelItem.status === "PENDING" && (
        <ConfirmModal
          open
          title="Cancelar platillo"
          message={`¿Quitar «${cancelItem.quantity}× ${cancelItem.dishNameSnapshot}»? Aún no se ha enviado a cocina.`}
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

      <ToastHost toasts={toasts} onClose={dismiss} />
    </div>
  );
}

// ───────────────────────────────────────────────────── Menu modal ──
function MenuModal({ open, onClose, onAdd, busy }: {
  open: boolean; onClose: () => void;
  onAdd: (dishId: string, quantity: number, modifiers: string | null, kitchenNotes: string | null) => Promise<boolean>;
  busy: boolean;
}) {
  const [cats, setCats] = useState<MenuCat[] | null>(null);
  const [activeCat, setActiveCat] = useState<string>("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MenuDish | null>(null);
  const [qty, setQty] = useState(1);
  const [modifiers, setModifiers] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) { setSelected(null); setQuery(""); return; }
    if (cats) return;
    apiFetch<MenuCat[]>("/api/menu").then((r) => {
      if (r.ok) { setCats(r.data!); setActiveCat(r.data![0]?.id ?? ""); }
    });
  }, [open, cats]);

  const dishes = useMemo(() => {
    if (!cats) return [];
    const base = query.trim()
      ? cats.flatMap((c) => c.dishes).filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
      : (cats.find((c) => c.id === activeCat)?.dishes ?? []);
    return base;
  }, [cats, activeCat, query]);

  const resetForm = () => { setSelected(null); setQty(1); setModifiers(""); setNotes(""); };

  const add = async () => {
    if (!selected) return;
    const ok = await onAdd(selected.id, qty, modifiers.trim() || null, notes.trim() || null);
    if (ok) resetForm();
  };

  return (
    <Modal open={open} title={selected ? selected.name : "Agregar del menú"} onClose={() => { resetForm(); onClose(); }} width={520}>
      {cats === null ? (
        <Spinner label="Cargando menú…" />
      ) : selected ? (
        <>
          <div style={{ color: C.gold, fontWeight: 800, fontSize: "1.05rem" }}>{formatMXN(selected.price)}</div>
          <label style={{ ...fld.label, marginTop: 16 }}>Cantidad</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button style={stepper} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <span style={{ color: C.cream, fontWeight: 800, fontSize: "1.2rem", minWidth: 36, textAlign: "center" }}>{qty}</span>
            <button style={stepper} onClick={() => setQty((q) => Math.min(50, q + 1))}>+</button>
          </div>
          <label style={{ ...fld.label, marginTop: 16 }}>Modificadores (opcional)</label>
          <input style={fld.input} value={modifiers} onChange={(e) => setModifiers(e.target.value)} placeholder="ej. sin cebolla, término medio" />
          <label style={{ ...fld.label, marginTop: 14 }}>Notas a cocina (opcional)</label>
          <input style={fld.input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ej. alergia a nuez" />
          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 20 }}>
            <button style={btn.ghost} onClick={resetForm} disabled={busy}>← Menú</button>
            <button style={{ ...btn.primary, opacity: busy ? 0.6 : 1 }} onClick={add} disabled={busy}>
              {busy ? "Agregando…" : `Agregar ${qty}`}
            </button>
          </div>
        </>
      ) : (
        <>
          <input style={{ ...fld.input, marginBottom: 12 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar platillo…" />
          {!query.trim() && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, marginBottom: 6 }}>
              {cats.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  style={{
                    ...catTab,
                    background: cat.id === activeCat ? C.gold : "transparent",
                    color: cat.id === activeCat ? "#fff" : C.dim,
                    borderColor: cat.id === activeCat ? C.gold : C.line,
                  }}
                >{cat.name}</button>
              ))}
            </div>
          )}
          <div style={{ maxHeight: "46vh", overflowY: "auto" }}>
            {dishes.length === 0 ? (
              <EmptyState text="Sin platillos." />
            ) : dishes.map((d) => (
              <button key={d.id} style={dishRow} onClick={() => { setSelected(d); setQty(1); }}>
                <span style={{ color: C.cream, fontSize: "0.9rem" }}>{d.name}</span>
                <span style={{ color: C.gold, fontWeight: 700, fontSize: "0.85rem" }}>{formatMXN(d.price)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

const stepper: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 9, border: `1px solid ${C.line}`,
  background: "transparent", color: C.cream, fontSize: "1.3rem", cursor: "pointer",
};
const catTab: React.CSSProperties = {
  padding: "7px 13px", borderRadius: 999, border: "1px solid", fontSize: "0.78rem",
  fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit",
};
const dishRow: React.CSSProperties = {
  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
  padding: "12px 12px", borderRadius: 9, border: "none", background: "transparent",
  borderBottom: `1px solid ${C.line}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
};

const page: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: C.bg },
  main: { padding: "18px", maxWidth: 720, margin: "0 auto", paddingBottom: 60 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  panel: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 14 },
  panelHead: { padding: "12px 18px", borderBottom: `1px solid ${C.line}`, color: C.faint, fontSize: "0.66rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 },
  itemRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${C.line}` },
  cancelX: { width: 30, height: 30, borderRadius: 7, border: `1px solid ${C.red}`, background: "transparent", color: C.red, fontSize: "1.1rem", cursor: "pointer", lineHeight: 1 },
  actions: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 },
};
