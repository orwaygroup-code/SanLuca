"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import {
  C, StaffHeader, Spinner, EmptyState, Badge, Modal, ConfirmModal, btn, fld, formatMXN,
  STATUS_LABEL, STATUS_COLOR, useToasts, ToastHost, useStaffLogout,
} from "@/components/staff/ui";
import { apiFetch, comandaLabel, type TableStatus, type ReservationToday, type Comanda, type CashSession, type CutSnapshot, type PayResult } from "@/components/staff/types";
import { GoldSelect } from "@/components/ui/GoldSelect";
import { TurnoBar, OpenTurnoModal, CloseCashSessionModal, CajaMonitor, PayModal } from "@/components/staff/caja";
import { Tour, type TourStep } from "@/components/staff/Tour";
import { TipsPanel } from "@/components/staff/TipsPanel";

/** Tutorial guiado de la vista Caja / Operación. */
const OPERACION_TOUR: TourStep[] = [
  { title: "Tu vista de Caja y Hostess", body: "Desde aquí sientas reservas, ves las cuentas activas, cobras y haces el corte del turno." },
  { target: "turno", title: "Abre el cajón primero", body: "Antes de cobrar, abre el turno con el fondo inicial. Aquí mismo cierras la caja y haces el corte (arqueo + diferencia).", task: "Si no hay turno, toca «Abrir cajón»." },
  { target: "tabs", title: "Cinco pestañas", body: "«Reservas» para sentar, «Mesas» para las cuentas activas, «Para llevar» para cuentas sin mesa, «Monitor» para la venta del turno, y «Propinas» para el reparto de puntos." },
  { target: "monitor", title: "Monitor del turno (corte X)", body: "Cuánto llevas cobrado por método (efectivo/tarjeta/transferencia), propinas y el efectivo esperado en el cajón — sin cerrar nada.", task: "Toca «Monitor» para verlo." },
  { title: "A cobrar", body: "En «Mesas», toca «Cobrar» en una cuenta para registrar el pago (mixto/parcial/propina/cambio). Reabre este tutorial con «?» cuando quieras." },
];

const MX_TZ = "America/Mexico_City";
function hhmm(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: MX_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

/** Vista Operación (Perla) — sentar reservas, mapa de mesas, cerrar/cobrar comandas. */
export default function OperacionPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const { toasts, push, dismiss } = useToasts();

  const [tab, setTab] = useState<"reservas" | "mesas" | "llevar" | "monitor" | "propinas">("reservas");
  const [reservations, setReservations] = useState<ReservationToday[] | null>(null);
  const [tables, setTables] = useState<TableStatus[] | null>(null);
  const [seatRes, setSeatRes] = useState<ReservationToday | null>(null);
  const [closeTarget, setCloseTarget] = useState<TableStatus | null>(null);
  const [busy, setBusy] = useState(false);

  // ── caja / turno ──
  const [session, setSession] = useState<CashSession | null>(null);
  const [cut, setCut] = useState<CutSnapshot | null>(null);
  const [openTurno, setOpenTurno] = useState(false);
  const [closeTurno, setCloseTurno] = useState(false);
  const [payTarget, setPayTarget] = useState<number | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const autoTourDone = useRef(false);
  const [takeout, setTakeout] = useState<Comanda[] | null>(null); // cuentas sin mesa (para llevar)
  const [newAccount, setNewAccount] = useState(false);

  const allowed = staff && ["OPERATION", "CAPTAIN", "MANAGER"].includes(staff.role);

  const loadSession = useCallback(async () => {
    const r = await apiFetch<{ session: CashSession | null; cut: CutSnapshot | null }>("/api/caja/sessions/current");
    if (r.ok) { setSession(r.data!.session); setCut(r.data!.cut); }
  }, []);

  const load = useCallback(async () => {
    const [res, tbl, cmd] = await Promise.all([
      apiFetch<ReservationToday[]>("/api/comandas/reservations-today"),
      apiFetch<TableStatus[]>("/api/comandas/tables-status"),
      apiFetch<Comanda[]>("/api/comandas"),
    ]);
    if (res.ok) setReservations(res.data!); else { setReservations([]); push(res.error ?? "Error reservas", "error"); }
    if (tbl.ok) setTables(tbl.data!); else { setTables([]); push(tbl.error ?? "Error mesas", "error"); }
    setTakeout(cmd.ok ? (cmd.data ?? []).filter((c) => !c.table) : []); // solo cuentas sin mesa
    await loadSession();
  }, [push, loadSession]);

  useEffect(() => {
    if (!loading && !staff) { router.replace("/staff/login?next=/staff/operacion"); return; }
    if (staff && !allowed) { router.replace("/staff/login"); return; }
    if (staff && allowed) load();
  }, [loading, staff, allowed, router, load]);

  // Auto-abrir el tutorial la primera vez (una vez por dispositivo).
  useEffect(() => {
    if (!autoTourDone.current && staff && allowed && typeof window !== "undefined" && !localStorage.getItem("sl_tour_operacion_v1")) {
      autoTourDone.current = true;
      setTourOpen(true);
    }
  }, [staff, allowed]);
  const closeTour = () => { setTourOpen(false); try { localStorage.setItem("sl_tour_operacion_v1", "1"); } catch { /* ignore */ } };

  const doClose = async () => {
    if (!closeTarget?.comanda) return;
    setBusy(true);
    const r = await apiFetch<Comanda>(`/api/comandas/${closeTarget.comanda.id}/close`, { method: "POST" });
    setBusy(false);
    setCloseTarget(null);
    if (r.ok) { push("Comanda cerrada (pagada)", "success"); load(); }
    else push(r.error ?? "No se pudo cerrar", "error");
  };

  if (loading || !staff || !allowed) return <div style={page.root}><Spinner /></div>;

  const freeTables = (tables ?? []).filter((t) => t.state === "FREE");

  return (
    <div style={page.root}>
      <StaffHeader
        title="Operación"
        role={staff.role}
        userName={staff.fullName}
        onLogout={logout}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button data-tour="help" onClick={() => setTourOpen(true)} title="Tutorial" aria-label="Abrir tutorial"
              style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.gold, fontWeight: 800, fontSize: "1.05rem", cursor: "pointer" }}>?</button>
            <button style={btn.ghost} onClick={load}>↻</button>
          </div>
        }
      />

      <div data-tour="turno"><TurnoBar session={session} cut={cut} onOpenTurno={() => setOpenTurno(true)} onCloseTurno={() => setCloseTurno(true)} /></div>

      <div style={page.tabs} data-tour="tabs">
        <button style={{ ...page.tab, ...(tab === "reservas" ? page.tabOn : {}) }} onClick={() => setTab("reservas")}>Reservas de hoy</button>
        <button style={{ ...page.tab, ...(tab === "mesas" ? page.tabOn : {}) }} onClick={() => setTab("mesas")}>Mesas</button>
        <button style={{ ...page.tab, ...(tab === "llevar" ? page.tabOn : {}) }} onClick={() => setTab("llevar")}>Para llevar</button>
        <button data-tour="monitor" style={{ ...page.tab, ...(tab === "monitor" ? page.tabOn : {}) }} onClick={() => { setTab("monitor"); loadSession(); }}>Monitor</button>
        <button style={{ ...page.tab, ...(tab === "propinas" ? page.tabOn : {}) }} onClick={() => { setTab("propinas"); loadSession(); }}>Propinas</button>
      </div>

      <main style={page.main}>
        {tab === "reservas" ? (
          reservations === null ? <Spinner /> :
          reservations.length === 0 ? <EmptyState text="No hay reservas para hoy." /> : (
            <div style={page.list}>
              {reservations.map((r) => (
                <div key={r.id} style={page.resRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: C.cream, fontWeight: 700 }}>{hhmm(r.date)} · {r.guestName}</div>
                    <div style={{ color: C.dim, fontSize: "0.8rem", marginTop: 2 }}>
                      {r.guests} pers{r.table ? ` · Mesa ${r.table.number} (${r.table.section.name})` : r.sectionPreference ? ` · pref. ${r.sectionPreference}` : ""}
                    </div>
                  </div>
                  {r.comanda ? (
                    <button style={btn.ghost} onClick={() => router.push(`/staff/comandas/${r.comanda!.id}`)}>
                      Ver {r.comanda.folio}
                    </button>
                  ) : (
                    <button style={btn.primary} onClick={() => setSeatRes(r)}>Sentar</button>
                  )}
                </div>
              ))}
            </div>
          )
        ) : tab === "mesas" ? (
          tables === null ? <Spinner /> : (
            tables!.length === 0 ? <EmptyState text="Sin mesas activas." /> : (
            <div style={page.grid}>
              {tables!.map((t) => (
                <div key={t.id} style={{ ...page.tableCard, borderColor: t.state === "FREE" ? C.line : (STATUS_COLOR[t.state] ?? C.line) }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: C.cream, fontWeight: 800 }}>Mesa {t.number}</span>
                    <Badge text={STATUS_LABEL[t.state] ?? t.state} color={STATUS_COLOR[t.state] ?? C.dim} />
                  </div>
                  <div style={{ color: C.faint, fontSize: "0.74rem", marginTop: 4 }}>{t.section} · cap. {t.capacity}</div>
                  {t.comanda && (
                    <>
                      <div style={{ color: C.cream, fontSize: "0.82rem", marginTop: 8 }}>
                        {t.comanda.folio} · {formatMXN(t.comanda.total)}
                      </div>
                      {t.comanda.waiter && <div style={{ color: C.faint, fontSize: "0.72rem" }}>{t.comanda.waiter.fullName}</div>}
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        <button style={{ ...btn.ghost, padding: "7px 12px", fontSize: "0.78rem" }} onClick={() => router.push(`/staff/comandas/${t.comanda!.id}`)}>Ver</button>
                        <button style={{ ...btn.primary, padding: "7px 12px", fontSize: "0.78rem" }} onClick={() => setPayTarget(t.comanda!.id)}>Cobrar</button>
                        <button style={{ ...btn.ghost, padding: "7px 12px", fontSize: "0.72rem" }} onClick={() => setCloseTarget(t)}>Cerrar</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            )
          )
        ) : tab === "llevar" ? (
          <div>
            <button style={{ ...btn.primary, marginBottom: 14 }} onClick={() => setNewAccount(true)}>+ Nueva cuenta (para llevar / sin mesa)</button>
            {takeout === null ? <Spinner /> : takeout.length === 0 ? (
              <EmptyState text="Sin cuentas para llevar. Crea una con «+ Nueva cuenta»." />
            ) : (
              <div style={page.grid}>
                {takeout.map((c) => (
                  <div key={c.id} style={{ ...page.tableCard, borderColor: STATUS_COLOR[c.status] ?? C.line }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ color: C.cream, fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{comandaLabel(c)}</span>
                      <Badge text={STATUS_LABEL[c.status] ?? c.status} color={STATUS_COLOR[c.status] ?? C.dim} />
                    </div>
                    <div style={{ color: C.cream, fontSize: "0.82rem", marginTop: 8 }}>{c.folio} · {formatMXN(Number(c.total))}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <button style={{ ...btn.ghost, padding: "7px 12px", fontSize: "0.78rem" }} onClick={() => router.push(`/staff/comandas/${c.id}`)}>Ver</button>
                      <button style={{ ...btn.primary, padding: "7px 12px", fontSize: "0.78rem" }} onClick={() => setPayTarget(c.id)}>Cobrar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === "monitor" ? (
          <CajaMonitor session={session} cut={cut} />
        ) : (
          <TipsPanel onToast={push} />
        )}
      </main>

      <SeatModal
        res={seatRes}
        freeTables={freeTables}
        onClose={() => setSeatRes(null)}
        onSeated={(id) => { setSeatRes(null); load(); router.push(`/staff/comandas/${id}`); }}
        onError={(m) => push(m, "error")}
      />

      <ConfirmModal
        open={!!closeTarget}
        title="Cerrar sin cobro"
        message={closeTarget?.comanda ? `Marcar ${closeTarget.comanda.folio} (Mesa ${closeTarget.number}) como PAGADA y liberar la mesa SIN registrar cobro (cortesía / ya pagada aparte). Para cobrar en caja usa «Cobrar». ¿Continuar?` : ""}
        confirmLabel="Cerrar sin cobro"
        busy={busy}
        onConfirm={doClose}
        onCancel={() => setCloseTarget(null)}
      />

      <NuevaCuentaModal
        open={newAccount}
        waiterId={staff.id}
        onClose={() => setNewAccount(false)}
        onCreated={(id) => { setNewAccount(false); router.push(`/staff/comandas/${id}`); }}
        onError={(m) => push(m, "error")}
      />

      <OpenTurnoModal
        open={openTurno}
        onClose={() => setOpenTurno(false)}
        onOpened={(s) => { setOpenTurno(false); setSession(s); loadSession(); push(`Turno ${s.folio} abierto`, "success"); }}
        onError={(m) => push(m, "error")}
      />

      <CloseCashSessionModal
        open={closeTurno}
        session={session}
        cut={cut}
        onClose={() => setCloseTurno(false)}
        onClosed={(r) => {
          setCloseTurno(false); setSession(null); setCut(null);
          const d = r.difference;
          push(Math.abs(d) < 0.01 ? "Corte cuadrado ✓" : `Corte: ${d > 0 ? "sobran" : "faltan"} ${formatMXN(Math.abs(d))}`, Math.abs(d) < 0.01 ? "success" : "info");
        }}
        onError={(m) => push(m, "error")}
      />

      <PayModal
        open={payTarget !== null}
        comandaId={payTarget}
        hasOpenSession={!!session}
        onClose={() => setPayTarget(null)}
        onPaid={(r: PayResult) => {
          setPayTarget(null);
          push(r.settled ? "Cuenta cobrada y cerrada" : `Abono registrado · restan ${formatMXN(r.remaining)}`, "success");
          if (r.changeGiven > 0) push(`Cambio: ${formatMXN(r.changeGiven)}`, "info");
          load();
        }}
        onError={(m) => push(m, "error")}
      />

      <Tour steps={OPERACION_TOUR} open={tourOpen} onClose={closeTour} />

      <ToastHost toasts={toasts} onClose={dismiss} />
    </div>
  );
}

function SeatModal({ res, freeTables, onClose, onSeated, onError }: {
  res: ReservationToday | null; freeTables: TableStatus[];
  onClose: () => void; onSeated: (comandaId: number) => void; onError: (m: string) => void;
}) {
  const [tableId, setTableId] = useState("");
  const [guests, setGuests] = useState(2);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (res) { setTableId(res.tableId ?? ""); setGuests(res.guests || 2); }
  }, [res]);

  const options = useMemo(() => {
    if (!res) return freeTables;
    // si la reserva ya tiene mesa asignada, ofrécela aunque no esté "FREE" en el mapa
    if (res.table && !freeTables.some((t) => t.id === res.table!.id)) {
      return [{ id: res.table.id, number: res.table.number, capacity: 0, section: res.table.section.name, state: "FREE" as const, comanda: null }, ...freeTables];
    }
    return freeTables;
  }, [res, freeTables]);

  const seat = async () => {
    if (!res || !tableId || busy) return;
    setBusy(true);
    const r = await apiFetch<Comanda>("/api/comandas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, guests, reservationId: res.id }),
    });
    setBusy(false);
    if (r.ok) onSeated(r.data!.id);
    else onError(r.error ?? "No se pudo abrir la comanda");
  };

  return (
    <Modal open={!!res} title={res ? `Sentar a ${res.guestName}` : ""} onClose={onClose}>
      <label style={fld.label}>Mesa</label>
      <GoldSelect
        value={tableId}
        onChange={setTableId}
        options={options.map((t) => ({ value: t.id, label: `Mesa ${t.number} · ${t.section}${t.capacity ? ` (cap. ${t.capacity})` : ""}` }))}
        placeholder="— Selecciona mesa —"
      />
      <label style={{ ...fld.label, marginTop: 16 }}>Comensales</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button style={stepper} onClick={() => setGuests((g) => Math.max(1, g - 1))}>−</button>
        <span style={{ color: C.cream, fontWeight: 800, fontSize: "1.2rem", minWidth: 36, textAlign: "center" }}>{guests}</span>
        <button style={stepper} onClick={() => setGuests((g) => Math.min(40, g + 1))}>+</button>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
        <button style={{ ...btn.primary, opacity: !tableId || busy ? 0.5 : 1 }} onClick={seat} disabled={!tableId || busy}>
          {busy ? "Abriendo…" : "Abrir comanda"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────── Modal: cuenta sin mesa (para llevar) ──
function NuevaCuentaModal({ open, waiterId, onClose, onCreated, onError }: {
  open: boolean; waiterId: number;
  onClose: () => void; onCreated: (id: number) => void; onError: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setName(""); setBusy(false); } }, [open]);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const r = await apiFetch<Comanda>("/api/comandas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customName: name.trim(), waiterId }),
    });
    setBusy(false);
    if (r.ok) onCreated(r.data!.id);
    else onError(r.error ?? "No se pudo crear la cuenta");
  };

  return (
    <Modal open={open} title="Nueva cuenta sin mesa" onClose={onClose}>
      <p style={{ margin: "0 0 4px", color: C.dim, fontSize: "0.86rem", lineHeight: 1.5 }}>
        Para llevar, o una cuenta especial sin mesa. Ponle un nombre para identificarla.
      </p>
      <label style={{ ...fld.label, marginTop: 12 }}>Nombre de la cuenta</label>
      <input style={fld.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Para llevar - Juan, Cuenta barra 3" autoFocus />
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
        <button style={{ ...btn.primary, opacity: !name.trim() || busy ? 0.5 : 1 }} onClick={submit} disabled={!name.trim() || busy}>
          {busy ? "Creando…" : "Crear cuenta"}
        </button>
      </div>
    </Modal>
  );
}

const stepper: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 9, border: `1px solid ${C.line}`,
  background: "transparent", color: C.cream, fontSize: "1.3rem", cursor: "pointer",
};

const page: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: C.bg },
  tabs: { display: "flex", gap: 6, padding: "12px 18px 0", maxWidth: 980, margin: "0 auto", width: "100%", boxSizing: "border-box" },
  tab: { flex: 1, padding: "11px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.84rem", cursor: "pointer", fontFamily: "inherit" },
  tabOn: { background: C.panel, color: C.cream, borderColor: C.border },
  main: { padding: "16px 18px", maxWidth: 980, margin: "0 auto" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  resRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 },
  tableCard: { background: C.panel, border: "1px solid", borderRadius: 12, padding: "14px 16px" },
};
