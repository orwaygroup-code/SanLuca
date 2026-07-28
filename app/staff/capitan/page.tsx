"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import {
  C, StaffHeader, Spinner, EmptyState, Badge, Modal, ReasonModal, btn, fld, formatMXN,
  STATUS_LABEL, STATUS_COLOR, useToasts, ToastHost, useStaffLogout,
} from "@/components/staff/ui";
import { apiFetch, type Comanda, type TableStatus } from "@/components/staff/types";
import { GoldSelect } from "@/components/ui/GoldSelect";
import { Tour, type TourStep } from "@/components/staff/Tour";

interface WaiterOpt { id: number; fullName: string; role: string }

/** Tutorial guiado de la vista Capitán. */
const CAPITAN_TOUR: TourStep[] = [
  { title: "Vista Capitán", body: "Supervisas TODAS las comandas del piso, sin importar de qué mesero sean. Desde aquí mueves mesas, reasignas meseros o cancelas cuentas." },
  { target: "grid", title: "Todo el piso a la vista", body: "Cada tarjeta es una comanda activa: folio, mesa o cuenta, mesero, número de personas y total en vivo." },
  { target: "acciones", title: "Acciones de supervisión", body: "En cada cuenta: «Ver» abre el detalle, «Mover mesa» la cambia de lugar, «Cambiar mesero» la reasigna, y «Cancelar» la anula (pide motivo para auditoría)." },
  { target: "refrescar", title: "Mantén el piso al día", body: "El piso cambia rápido. Toca «↻» para refrescar la lista, o reabre este tutorial con el botón «?»." },
];

/** Vista Capitán — supervisión de todas las comandas: mover mesa, cambiar mesero, cancelar. */
export default function CapitanPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const { toasts, push, dismiss } = useToasts();

  const [comandas, setComandas] = useState<Comanda[] | null>(null);
  const [freeTables, setFreeTables] = useState<TableStatus[]>([]);
  const [waiters, setWaiters] = useState<WaiterOpt[]>([]);
  const [busy, setBusy] = useState(false);

  const [moveTarget, setMoveTarget] = useState<Comanda | null>(null);
  const [waiterTarget, setWaiterTarget] = useState<Comanda | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Comanda | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const autoTourDone = useRef(false);

  const allowed = staff && (staff.role === "CAPTAIN" || staff.role === "MANAGER");

  const load = useCallback(async () => {
    const [cs, ts, ws] = await Promise.all([
      apiFetch<Comanda[]>("/api/comandas"),
      apiFetch<TableStatus[]>("/api/comandas/tables-status"),
      apiFetch<WaiterOpt[]>("/api/comandas/waiters"),
    ]);
    if (cs.ok) setComandas(cs.data!); else { setComandas([]); push(cs.error ?? "Error comandas", "error"); }
    if (ts.ok) setFreeTables(ts.data!.filter((t) => t.state === "FREE"));
    if (ws.ok) setWaiters(ws.data!);
  }, [push]);

  useEffect(() => {
    if (!loading && !staff) { router.replace("/staff/login?next=/staff/capitan"); return; }
    if (staff && !allowed) { router.replace("/staff/login"); return; }
    if (staff && allowed) load();
  }, [loading, staff, allowed, router, load]);

  // Auto-abrir el tutorial la primera vez (una vez por dispositivo).
  useEffect(() => {
    if (!autoTourDone.current && staff && allowed && typeof window !== "undefined" && !localStorage.getItem("sl_tour_capitan_v1")) {
      autoTourDone.current = true;
      setTourOpen(true);
    }
  }, [staff, allowed]);
  const closeTour = () => { setTourOpen(false); try { localStorage.setItem("sl_tour_capitan_v1", "1"); } catch { /* ignore */ } };

  const act = useCallback(async (path: string, body: unknown, okMsg: string, done: () => void) => {
    setBusy(true);
    const r = await apiFetch<Comanda>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (r.ok) { push(okMsg, "success"); done(); load(); }
    else push(r.error ?? "Error", "error");
  }, [push, load]);

  if (loading || !staff || !allowed) return <div style={page.root}><Spinner /></div>;

  return (
    <div style={page.root}>
      <StaffHeader title="Capitán" role={staff.role} userName={staff.fullName} onLogout={logout}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setTourOpen(true)} title="Tutorial" aria-label="Abrir tutorial"
              style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.gold, fontWeight: 800, fontSize: "1.05rem", cursor: "pointer" }}>?</button>
            <button data-tour="refrescar" style={btn.ghost} onClick={load}>↻</button>
          </div>
        } />

      <main style={page.main}>
        {comandas === null ? <Spinner /> :
        comandas.length === 0 ? <EmptyState text="No hay comandas activas en el piso." /> : (
          <div style={page.grid} data-tour="grid">
            {comandas.map((c, idx) => {
              const live = c.items.filter((i) => i.status !== "CANCELLED");
              return (
                <div key={c.id} style={page.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: C.gold, fontWeight: 800, fontSize: "0.78rem" }}>{c.folio}</span>
                    <Badge text={STATUS_LABEL[c.status] ?? c.status} color={STATUS_COLOR[c.status] ?? C.dim} />
                  </div>
                  <div style={{ color: C.cream, fontSize: "1.05rem", fontWeight: 700, marginTop: 8 }}>
                    {c.table ? `Mesa ${c.table.number} · ${c.table.section.name}` : (c.customName || "Cuenta sin mesa")}
                  </div>
                  <div style={{ color: C.dim, fontSize: "0.8rem", marginTop: 2 }}>
                    {c.waiter.fullName} · {c.guestsActual} pers · {live.length} items
                  </div>
                  <div style={{ color: C.cream, fontSize: "1.05rem", fontWeight: 800, margin: "8px 0 12px" }}>{formatMXN(Number(c.total))}</div>
                  <div style={page.cardActions} data-tour={idx === 0 ? "acciones" : undefined}>
                    <button style={mini} onClick={() => router.push(`/staff/comandas/${c.id}`)}>Ver</button>
                    <button style={mini} onClick={() => setMoveTarget(c)}>Mover mesa</button>
                    <button style={mini} onClick={() => setWaiterTarget(c)}>Cambiar mesero</button>
                    <button style={{ ...mini, color: C.red, borderColor: C.red }} onClick={() => setCancelTarget(c)}>Cancelar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Mover mesa */}
      <PickModal
        open={!!moveTarget}
        title={moveTarget ? `Mover ${moveTarget.folio} de ${moveTarget.table ? `Mesa ${moveTarget.table.number}` : "cuenta sin mesa"}` : ""}
        label="Nueva mesa (libre)"
        options={freeTables.map((t) => ({ value: t.id, label: `Mesa ${t.number} · ${t.section} (cap. ${t.capacity})` }))}
        emptyMsg="No hay mesas libres."
        busy={busy}
        onCancel={() => setMoveTarget(null)}
        onConfirm={(toTableId, reason) => moveTarget && act(`/api/comandas/${moveTarget.id}/change-table`, { toTableId, reason: reason || null }, "Comanda movida", () => setMoveTarget(null))}
      />

      {/* Cambiar mesero */}
      <PickModal
        open={!!waiterTarget}
        title={waiterTarget ? `Reasignar mesero · ${waiterTarget.folio}` : ""}
        label="Nuevo mesero"
        options={waiters.filter((w) => w.id !== waiterTarget?.waiterId).map((w) => ({ value: String(w.id), label: `${w.fullName} (${w.role})` }))}
        emptyMsg="No hay otros meseros activos."
        busy={busy}
        onCancel={() => setWaiterTarget(null)}
        onConfirm={(toWaiterId, reason) => waiterTarget && act(`/api/comandas/${waiterTarget.id}/change-waiter`, { toWaiterId: Number(toWaiterId), reason: reason || null }, "Mesero reasignado", () => setWaiterTarget(null))}
      />

      {/* Cancelar comanda */}
      <ReasonModal
        open={!!cancelTarget}
        title={cancelTarget ? `Cancelar ${cancelTarget.folio}` : ""}
        label="Motivo de la cancelación (obligatorio)"
        confirmLabel="Cancelar comanda"
        danger
        busy={busy}
        onConfirm={(reason) => cancelTarget && act(`/api/comandas/${cancelTarget.id}/cancel`, { cancellationReason: reason }, "Comanda cancelada", () => setCancelTarget(null))}
        onCancel={() => setCancelTarget(null)}
      />

      <Tour steps={CAPITAN_TOUR} open={tourOpen} onClose={closeTour} />
      <ToastHost toasts={toasts} onClose={dismiss} />
    </div>
  );
}

/** Modal genérico: elegir una opción de un <select> + motivo opcional. */
function PickModal({ open, title, label, options, emptyMsg, busy, onConfirm, onCancel }: {
  open: boolean; title: string; label: string; options: { value: string; label: string }[];
  emptyMsg: string; busy: boolean; onConfirm: (value: string, reason: string) => void; onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => { if (!open) { setValue(""); setReason(""); } }, [open]);

  return (
    <Modal open={open} title={title} onClose={onCancel}>
      {options.length === 0 ? (
        <p style={{ color: C.amber, fontSize: "0.85rem", margin: "0 0 16px" }}>{emptyMsg}</p>
      ) : (
        <>
          <label style={fld.label}>{label}</label>
          <GoldSelect value={value} onChange={setValue} options={options} placeholder="— Selecciona —" />
          <label style={{ ...fld.label, marginTop: 16 }}>Motivo (opcional, auditoría)</label>
          <input style={fld.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ej. cliente cambió de lugar" />
        </>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
        <button style={btn.ghost} onClick={onCancel} disabled={busy}>Cancelar</button>
        <button style={{ ...btn.primary, opacity: !value || busy ? 0.5 : 1 }} onClick={() => onConfirm(value, reason.trim())} disabled={!value || busy}>
          {busy ? "…" : "Confirmar"}
        </button>
      </div>
    </Modal>
  );
}

const mini: React.CSSProperties = {
  padding: "7px 11px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent",
  color: C.dim, fontSize: "0.76rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};

const page: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: C.bg },
  main: { padding: "18px", maxWidth: 1200, margin: "0 auto" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 },
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 16px 18px" },
  cardActions: { display: "flex", flexWrap: "wrap", gap: 7 },
};
