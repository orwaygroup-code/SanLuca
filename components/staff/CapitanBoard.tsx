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
import { LiveStats } from "@/components/staff/LiveStats";
import { FloorMap } from "@/components/staff/FloorMap";

interface WaiterOpt { id: number; fullName: string; role: string }

// Separación del piso por estado. Las cobradas NO se muestran como tarjetas (quedan
// archivadas en el Historial); su total sí sigue contando en "Ventas en vivo".
const GROUPS: { key: string; title: string; statuses: string[]; color: string }[] = [
  { key: "service", title: "En servicio", statuses: ["OPEN", "IN_SERVICE"], color: C.blue },
  { key: "billing", title: "Por cobrar", statuses: ["AWAITING_PAYMENT", "PARTIALLY_PAID"], color: C.amber },
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
  // Al abrir una comanda, guarda en ?back= el ORIGEN completo (path del modo + estado:
  // vista mapa/recuadros y área) para que "Volver" regrese exactamente a donde estabas.
  const detailHref = (id: number) => {
    const base = inAdmin ? "/admin/piso" : "/staff/capitan";
    const back = `${base}?view=${view}${area ? `&area=${encodeURIComponent(area)}` : ""}`;
    const target = inAdmin ? `/admin/piso/${id}` : `/staff/comandas/${id}`;
    return `${target}?back=${encodeURIComponent(back)}`;
  };
  const { staff, loading } = useStaffSession();
  const { toasts, push, dismiss } = useToasts();

  const [comandas, setComandas] = useState<Comanda[] | null>(null);
  const [freeTables, setFreeTables] = useState<TableStatus[]>([]);
  const [allTables, setAllTables] = useState<TableStatus[]>([]); // todas las mesas (para el mapa)
  const [waiters, setWaiters] = useState<WaiterOpt[]>([]);
  const [busy, setBusy] = useState(false);

  const [moveTarget, setMoveTarget] = useState<Comanda | null>(null);
  const [waiterTarget, setWaiterTarget] = useState<Comanda | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Comanda | null>(null);
  const [reopenTarget, setReopenTarget] = useState<Comanda | null>(null);
  const [showStats, setShowStats] = useState(true);
  const [view, setView] = useState<"cards" | "map">("cards");
  const [showPaid, setShowPaid] = useState(false);
  const [area, setArea] = useState<string | null>(null); // sección activa del mapa en móvil
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const u = () => setIsMobile(mq.matches);
    u(); mq.addEventListener("change", u);
    return () => mq.removeEventListener("change", u);
  }, []);
  // Restaura el ESTADO (vista mapa/recuadros y área) desde la URL, para que "Volver" regrese
  // exactamente a donde estabas (ver detailHref, que lo mete en ?back=).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("view") === "map") setView("map");
    else if (p.get("view") === "cards") setView("cards");
    const a = p.get("area");
    if (a) setArea(a);
  }, []);
  // En móvil + Mapa, el mapa ocupa toda la pantalla → ocultamos "Ventas en vivo".
  const mapFull = isMobile && view === "map";

  const allowed = !!staff && (staff.role === "CAPTAIN" || staff.role === "MANAGER");

  const load = useCallback(async () => {
    const [cs, ts, ws] = await Promise.all([
      apiFetch<Comanda[]>("/api/comandas?includePaidToday=1"),
      apiFetch<TableStatus[]>("/api/comandas/tables-status"),
      apiFetch<WaiterOpt[]>("/api/comandas/waiters"),
    ]);
    if (cs.ok) setComandas(cs.data!); else { setComandas([]); push(cs.error ?? "Error comandas", "error"); }
    if (ts.ok) { setFreeTables(ts.data!.filter((t) => t.state === "FREE")); setAllTables(ts.data!); }
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <ModeSwitch role={staff?.role} />
          <div style={vw.wrap} role="tablist" aria-label="Vista del piso">
            <button role="tab" aria-selected={view === "cards"} style={{ ...vw.btn, ...(view === "cards" ? vw.on : {}) }} onClick={() => setView("cards")}>Recuadros</button>
            <button role="tab" aria-selected={view === "map"} style={{ ...vw.btn, ...(view === "map" ? vw.on : {}) }} onClick={() => setView("map")}>Mapa</button>
          </div>
          {!mapFull && <button style={{ ...btn.ghost, minHeight: 40 }} onClick={() => setShowStats((v) => !v)}>{showStats ? "Ocultar ventas" : "Ventas en vivo"}</button>}
          <button data-tour="refrescar" style={{ ...btn.ghost, minHeight: 40 }} onClick={load}>↻ Actualizar</button>
        </div>
      </div>

      {showStats && comandas && !mapFull && <LiveStats comandas={comandas} />}

      {view === "map" ? (
        <FloorMap tables={allTables} onOpen={(id) => router.push(detailHref(id))} area={area} onArea={setArea} />
      ) : comandas === null ? <Spinner /> :
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
                                {/* Regla: una cuenta impresa / por cobrar NO se cancela aquí; hay que
                                    reabrirla primero (entra a «Ver» → «Reabrir cuenta»). */}
                                {(c.status === "OPEN" || c.status === "IN_SERVICE") ? (
                                  <button style={{ ...mini, color: C.red, borderColor: C.red }} onClick={() => setCancelTarget(c)}>Cancelar</button>
                                ) : (
                                  <button style={mini} onClick={() => router.push(detailHref(c.id))} title="Para cancelar una cuenta impresa, reábrela primero desde su detalle">Reabrir para cancelar</button>
                                )}
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

      {/* Ya pagadas de hoy: lista colapsable en renglones horizontales que abarcan el ancho.
          Se archivan aquí, no en las tarjetas. Único botón: "Ver más" → abre el detalle en
          solo-lectura (no se puede modificar una cuenta ya cobrada). */}
      {comandas && (() => {
        const paid = comandas.filter((c) => c.status === "PAID");
        return (
          <div style={{ marginTop: 24 }}>
            <button onClick={() => setShowPaid((v) => !v)} style={pd.toggle} aria-expanded={showPaid}>
              <span>Ya pagadas hoy · {paid.length}</span>
              <span style={{ transition: "transform .2s", transform: showPaid ? "rotate(180deg)" : "none", fontSize: "0.9rem" }}>▾</span>
            </button>
            {showPaid && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {paid.length === 0 ? (
                  <div style={{ color: C.faint, fontSize: "0.84rem", padding: "10px 4px" }}>Ninguna cobrada hoy.</div>
                ) : (
                  [...paid].sort((a, b) => (a.closedAt && b.closedAt ? (a.closedAt < b.closedAt ? 1 : -1) : 0)).map((c) => (
                    <div key={c.id} style={pd.row}>
                      <span style={pd.folio}>{c.folio}</span>
                      <span style={pd.place}>{c.table ? `Mesa ${c.table.number} · ${c.table.section.name}` : (c.customName || "Sin mesa")}</span>
                      <span style={pd.meta}>{c.waiter?.fullName ?? "—"}</span>
                      <span style={pd.metaSm}>{c.guestsActual} pers</span>
                      <span style={pd.metaSm}>{c.closedAt ? new Date(c.closedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                      <span style={pd.total}>{formatMXN(Number(c.total))}</span>
                      <button style={pd.more} onClick={() => router.push(detailHref(c.id))}>Ver más</button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })()}

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

const vw: Record<string, React.CSSProperties> = {
  wrap: { display: "inline-flex", gap: 3, padding: 3, background: "rgba(0,0,0,0.25)", border: `1px solid ${C.border}`, borderRadius: 999 },
  btn: { padding: "7px 14px", borderRadius: 999, border: "none", background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  on: { background: C.gold, color: "#16201f" },
};

const pd: Record<string, React.CSSProperties> = {
  toggle: { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 16px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel, color: C.dim, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" },
  row: { display: "flex", alignItems: "center", gap: 14, rowGap: 4, flexWrap: "wrap", width: "100%", padding: "10px 16px", borderRadius: 10, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.02)", boxSizing: "border-box" },
  folio: { color: C.gold, fontWeight: 800, fontSize: "0.76rem", minWidth: 100, flexShrink: 0 },
  place: { color: C.cream, fontWeight: 600, fontSize: "0.88rem", flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { color: C.dim, fontSize: "0.8rem", whiteSpace: "nowrap" },
  metaSm: { color: C.faint, fontSize: "0.76rem", whiteSpace: "nowrap" },
  total: { color: C.cream, fontWeight: 800, fontSize: "0.9rem", minWidth: 88, textAlign: "right", marginLeft: "auto" },
  more: { padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.gold, fontWeight: 700, fontSize: "0.74rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 },
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
