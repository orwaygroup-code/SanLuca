"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import {
  C, Spinner, EmptyState, Badge, Modal, ReasonModal, btn, fld, formatMXN,
  STATUS_LABEL, STATUS_COLOR, useToasts, ToastHost, usePoll,
} from "@/components/staff/ui";
import { apiFetch, type Comanda, type TableStatus } from "@/components/staff/types";
import { GoldSelect } from "@/components/ui/GoldSelect";
import { ReopenModal } from "@/components/staff/caja";
import { ModeSwitch } from "@/components/staff/ModeSwitch";

interface WaiterOpt { id: number; fullName: string; role: string }

// Separación del piso por estado. "Ya pagadas" solo trae las del día (API).
const GROUPS: { key: string; title: string; statuses: string[]; color: string }[] = [
  { key: "service", title: "En servicio", statuses: ["OPEN", "IN_SERVICE"], color: C.blue },
  { key: "billing", title: "Por cobrar", statuses: ["AWAITING_PAYMENT", "PARTIALLY_PAID"], color: C.amber },
  { key: "paid", title: "Ya pagadas · hoy", statuses: ["PAID"], color: C.green },
];

/**
 * Tablero de supervisión del piso: todas las comandas ACTIVAS + acciones (mover
 * mesa / cambiar mesero / cancelar). Compartido por `/staff/capitan` (con
 * StaffHeader) y `/admin/piso` (dentro del panel, conserva el menú lateral). No
 * trae encabezado propio: cada shell pone su identidad. Trae su propio refresco,
 * padding y toasts para renderizar igual en ambos contenedores.
 */
export function CapitanBoard() {
  const router = useRouter();
  // Dentro de /admin abrimos el detalle embebido (conserva el menú lateral);
  // en /staff/capitan, la vista staff de pantalla completa.
  const inAdmin = !!usePathname()?.startsWith("/admin");
  const detailHref = (id: number) => (inAdmin ? `/admin/piso/${id}?back=/admin/piso` : `/staff/comandas/${id}?back=/staff/capitan`);
  const { staff, loading } = useStaffSession();
  const { toasts, push, dismiss } = useToasts();

  const [comandas, setComandas] = useState<Comanda[] | null>(null);
  const [freeTables, setFreeTables] = useState<TableStatus[]>([]);
  const [waiters, setWaiters] = useState<WaiterOpt[]>([]);
  const [busy, setBusy] = useState(false);

  const [moveTarget, setMoveTarget] = useState<Comanda | null>(null);
  const [waiterTarget, setWaiterTarget] = useState<Comanda | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Comanda | null>(null);
  const [reopenTarget, setReopenTarget] = useState<Comanda | null>(null);

  const allowed = !!staff && (staff.role === "CAPTAIN" || staff.role === "MANAGER");

  const load = useCallback(async () => {
    const [cs, ts, ws] = await Promise.all([
      apiFetch<Comanda[]>("/api/comandas?includePaidToday=1"),
      apiFetch<TableStatus[]>("/api/comandas/tables-status"),
      apiFetch<WaiterOpt[]>("/api/comandas/waiters"),
    ]);
    if (cs.ok) setComandas(cs.data!); else { setComandas([]); push(cs.error ?? "Error comandas", "error"); }
    if (ts.ok) setFreeTables(ts.data!.filter((t) => t.state === "FREE"));
    if (ws.ok) setWaiters(ws.data!);
  }, [push]);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);
  usePoll(load, 7000, allowed); // refresco en vivo de comandas del piso

  const act = useCallback(async (path: string, body: unknown, okMsg: string, done: () => void) => {
    setBusy(true);
    const r = await apiFetch<Comanda>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (r.ok) { push(okMsg, "success"); done(); load(); }
    else push(r.error ?? "Error", "error");
  }, [push, load]);

  if (loading) return <div style={board.wrap}><Spinner /></div>;
  if (!allowed) return <div style={board.wrap}><EmptyState text="Esta vista necesita una sesión de piso (entra por PIN)." /></div>;

  return (
    <div style={board.wrap}>
      <div style={board.head}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={board.h1}>Piso en vivo</h1>
          {comandas && (() => { const a = comandas.filter((c) => c.status !== "PAID").length; return <span style={board.sub}>{a} activa{a === 1 ? "" : "s"}</span>; })()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ModeSwitch role={staff?.role} />
          <button data-tour="refrescar" style={{ ...btn.ghost, minHeight: 40 }} onClick={load}>↻ Actualizar</button>
        </div>
      </div>

      {comandas === null ? <Spinner /> :
      comandas.length === 0 ? <EmptyState text="No hay comandas en el piso." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }} data-tour="grid">
          {(() => {
            const firstGroup = GROUPS.find((g) => comandas.some((c) => g.statuses.includes(c.status)));
            return GROUPS.map((g) => {
              const list = comandas.filter((c) => g.statuses.includes(c.status));
              if (list.length === 0) return null;
              const paid = g.key === "paid";
              return (
                <section key={g.key}>
                  <div style={board.groupHead}>
                    <span style={{ ...board.groupTitle, color: g.color }}>{g.title}</span>
                    <span style={board.groupCount}>{list.length}</span>
                  </div>
                  <div style={board.grid}>
                    {list.map((c, idx) => {
                      const live = c.items.filter((i) => i.status !== "CANCELLED");
                      return (
                        <div key={c.id} style={board.card}>
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
                          <div style={board.cardActions} data-tour={g.key === firstGroup?.key && idx === 0 ? "acciones" : undefined}>
                            <button style={mini} onClick={() => router.push(detailHref(c.id))}>Ver</button>
                            {paid ? (
                              staff?.role === "MANAGER"
                                ? <button style={{ ...mini, color: C.gold, borderColor: C.gold }} onClick={() => setReopenTarget(c)}>Reabrir cuenta</button>
                                : <span style={{ color: C.faint, fontSize: "0.72rem" }}>Sellada</span>
                            ) : (
                              <>
                                <button style={mini} onClick={() => setMoveTarget(c)}>Mover mesa</button>
                                <button style={mini} onClick={() => setWaiterTarget(c)}>Cambiar mesero</button>
                                <button style={{ ...mini, color: C.red, borderColor: C.red }} onClick={() => setCancelTarget(c)}>Cancelar</button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            });
          })()}
        </div>
      )}

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

      {/* Reabrir cuenta pagada (del día). Supervisor: PIN + motivo. */}
      <ReopenModal
        open={!!reopenTarget}
        comanda={reopenTarget}
        onClose={() => setReopenTarget(null)}
        onDone={() => { setReopenTarget(null); push("Cuenta reabierta", "success"); load(); }}
        onError={(m) => push(m, "error")}
      />

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

const board: Record<string, React.CSSProperties> = {
  wrap: { padding: "18px 22px 44px", maxWidth: 1200, margin: "0 auto", width: "100%", boxSizing: "border-box" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 },
  h1: { margin: 0, color: C.cream, fontSize: "1.2rem", fontWeight: 800 },
  sub: { color: C.faint, fontSize: "0.8rem" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 },
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 16px 18px" },
  cardActions: { display: "flex", flexWrap: "wrap", gap: 7 },
  groupHead: { display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px" },
  groupTitle: { fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" },
  groupCount: { fontSize: "0.72rem", fontWeight: 700, color: C.faint, background: C.panel, borderRadius: 999, padding: "1px 9px", border: `1px solid ${C.line}` },
};
