"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import {
  C, Spinner, EmptyState, Badge, Modal, btn, fld, formatMXN,
  STATUS_LABEL, STATUS_COLOR, useToasts, ToastHost, useStaffLogout, usePoll,
} from "@/components/staff/ui";
import { apiFetch, comandaLabel, isBillPrinted, type TableStatus, type ReservationToday, type Comanda, type CashSession, type CutSnapshot, type PayResult } from "@/components/staff/types";
import { TurnoBar, OpenTurnoModal, CloseCashSessionModal, CajaMonitor, PayModal } from "@/components/staff/caja";
import { StaffShell } from "@/components/staff/StaffShell";
import { type OperTab } from "@/components/staff/StaffRail";
import { Icon, type IconName } from "@/components/staff/icons";
import { Tour, type TourStep } from "@/components/staff/Tour";
import { TipsPanel } from "@/components/staff/TipsPanel";

const AWAIT = STATUS_COLOR.AWAITING_PAYMENT; // #e0b054 — tinte "requiere caja"
const TAKEOUT_ALERT_MS = 90 * 60 * 1000; // #3 umbral de alerta para cuentas "para llevar" (1h30)

/** "hace 1h 42m" a partir de un ISO. */
function elapsedLabel(iso: string, nowTs: number): string {
  const mins = Math.max(0, Math.floor((nowTs - new Date(iso).getTime()) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Tutorial guiado de la vista Caja / Operación. */
const OPERACION_TOUR: TourStep[] = [
  { title: "Tu vista de Caja y Hostess", body: "Desde aquí sientas reservas, ves las cuentas activas, cobras y haces el corte del turno." },
  { target: "turno", title: "Abre el cajón primero", body: "Antes de cobrar, abre el turno con el fondo inicial. Aquí mismo cierras la caja y haces el corte (arqueo + diferencia).", task: "Si no hay turno, toca «Abrir cajón»." },
  { target: "tabs", title: "El riel de la izquierda", body: "Desde el riel cambias de vista: «Mesas» (cuentas activas y por cobrar), «Llegadas» (sentar las reservas de hoy) y «Llevar» (cuentas sin mesa). Abajo: «Reservas» e «Historial» para gestión, y «Monitor»/«Propinas» del turno." },
  { target: "monitor", title: "Monitor del turno (corte X)", body: "Cuánto llevas cobrado por método (efectivo/tarjeta/transferencia), propinas y el efectivo esperado en el cajón — sin cerrar nada.", task: "Toca «Monitor» en el riel." },
  { title: "A cobrar", body: "En «Mesas», lo que necesita tu caja sale hasta arriba: toca «Cobrar» para registrar el pago (mixto/parcial/propina/cambio). Reabre este tutorial con «Ayuda» cuando quieras." },
];

const MX_TZ = "America/Mexico_City";
function hhmm(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: MX_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

const TITLE_FOR: Record<OperTab, string> = {
  mesas: "Mesas", llegadas: "Llegadas de hoy", llevar: "Para llevar", monitor: "Monitor del turno", propinas: "Propinas",
};

const VALID_TABS: OperTab[] = ["mesas", "llegadas", "llevar", "monitor", "propinas"];

/**
 * Vista Operación (Perla) — sentar reservas, cuentas de mesa/llevar, cobrar y corte de caja.
 * `embedded`: se renderiza DENTRO del panel admin (/admin/caja), sin el riel de staff; el tab
 * lo controla la URL (prop `controlledTab` del server page). Suelto (/staff/operacion) usa su
 * riel y estado local.
 */
export function OperacionView({ embedded = false, controlledTab }: { embedded?: boolean; controlledTab?: string }) {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const { toasts, push, dismiss } = useToasts();

  const [tabState, setTab] = useState<OperTab>("mesas");
  // Suelto: restaura la pestaña desde la URL (?tab=…) al montar. Embebido: el tab viene de
  // controlledTab (el server page lee ?tab y lo pasa como prop, reactivo a la navegación).
  useEffect(() => {
    if (embedded) return;
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && VALID_TABS.includes(t as OperTab)) setTab(t as OperTab);
  }, [embedded]);
  const tab: OperTab = embedded && controlledTab && VALID_TABS.includes(controlledTab as OperTab) ? (controlledTab as OperTab) : tabState;
  const opBack = () => encodeURIComponent((embedded ? "/admin/caja?tab=" : "/staff/operacion?tab=") + tab);
  const [reservations, setReservations] = useState<ReservationToday[] | null>(null);
  const [tables, setTables] = useState<TableStatus[] | null>(null);
  const [seatRes, setSeatRes] = useState<ReservationToday | null>(null);

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
  const [printing, setPrinting] = useState<number | null>(null); // comanda cuyo ticket se está imprimiendo
  const [openingDrawer, setOpeningDrawer] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false); // modal de entrada/salida de efectivo
  const [nowTs, setNowTs] = useState(() => Date.now()); // #3 reloj para alertas de tiempo
  const [ackAlerts, setAckAlerts] = useState<Set<number>>(new Set()); // #3 llevar ya "OK"-eadas

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

  usePoll(load, 7000, !!(staff && allowed)); // refresco en vivo de mesas/reservas/cuentas

  // #3 Alerta por tiempo en cuentas "para llevar": tras 1h30 sin cerrarse, se avisa a la
  // cajera (banner persistente + modal que obliga OK). El reloj corre cada 20 s.
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);
  const overdueTakeout = useMemo(() => {
    const cutoff = nowTs - TAKEOUT_ALERT_MS;
    return (takeout ?? []).filter((c) => {
      const active = c.status !== "PAID" && c.status !== "CANCELLED" && c.status !== "MERGED";
      return active && new Date(c.openedAt).getTime() < cutoff;
    });
  }, [takeout, nowTs]);
  const unackedTakeout = overdueTakeout.filter((c) => !ackAlerts.has(c.id));

  // Auto-abrir el tutorial la primera vez (una vez por dispositivo).
  useEffect(() => {
    if (!autoTourDone.current && staff && allowed && typeof window !== "undefined" && !localStorage.getItem("sl_tour_operacion_v1")) {
      autoTourDone.current = true;
      setTourOpen(true);
    }
  }, [staff, allowed]);
  const closeTour = () => { setTourOpen(false); try { localStorage.setItem("sl_tour_operacion_v1", "1"); } catch { /* ignore */ } };

  // Perla imprime el ticket de una cuenta ya pedida (target CAJA) → habilita el cobro.
  const doPrintBill = async (comandaId: number) => {
    setPrinting(comandaId);
    const r = await apiFetch<Comanda>(`/api/comandas/${comandaId}/print`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    setPrinting(null);
    if (r.ok) { push("Ticket enviado a impresión", "success"); load(); }
    else push(r.error ?? "No se pudo imprimir", "error");
  };

  // Abre el cajón de dinero a mano (para dar cambio, etc.).
  const doOpenDrawer = async () => {
    setOpeningDrawer(true);
    const r = await apiFetch("/api/caja/drawer", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setOpeningDrawer(false);
    if (r.ok) push("Cajón abierto", "success");
    else push(r.error ?? "No se pudo abrir el cajón", "error");
  };

  if (loading || !staff || !allowed) return <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center" }}><Spinner /></div>;

  const occupied = (tables ?? []).filter((t) => t.comanda);
  const freeTables = (tables ?? []).filter((t) => t.state === "FREE");
  const llegadasPending = (reservations ?? []).filter((r) => !r.comanda);

  const subFor = (): string => {
    if (tab === "mesas") return occupied.length ? `${occupied.length} cuenta${occupied.length === 1 ? "" : "s"} activa${occupied.length === 1 ? "" : "s"}` : "sin cuentas activas";
    if (tab === "llegadas") return `${llegadasPending.length} por sentar`;
    if (tab === "llevar") return takeout ? `${takeout.length} cuenta${takeout.length === 1 ? "" : "s"}` : "";
    return "";
  };

  return (
    <>
      <StaffShell
        embedded={embedded}
        active={tab}
        counts={{ llegadas: llegadasPending.length, llevar: (takeout ?? []).length }}
        onTab={setTab}
        onRefresh={load}
        onHelp={() => setTourOpen(true)}
        onLogout={logout}
        userName={staff.fullName}
        role={staff.role}
        topBar={<div data-tour="turno"><TurnoBar session={session} cut={cut} onOpenTurno={() => setOpenTurno(true)} onCloseTurno={() => setCloseTurno(true)} /></div>}
      >
        <div style={sh.kicker}>
            <h1 style={sh.h1}>{TITLE_FOR[tab]}</h1>
            {subFor() && <span style={sh.sub}>{subFor()}</span>}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                style={{ ...btn.ghost, minHeight: 38, display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}
                onClick={() => setMoveOpen(true)}
                title="Registrar entrada o salida de efectivo del cajón"
              ><Icon name="coins" size={16} />Entrada / Salida</button>
              <button
                style={{ ...btn.ghost, minHeight: 38, display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8rem", opacity: openingDrawer ? 0.6 : 1 }}
                onClick={doOpenDrawer}
                disabled={openingDrawer}
                title="Abrir el cajón de dinero"
              ><Icon name="lock" size={16} />Abrir cajón</button>
            </div>
          </div>

          {/* #3 Banner persistente: cuentas para llevar con +1h30 sin cerrar. Se queda mientras
              la cuenta siga abierta; desaparece sola al cobrarse/cerrarse. */}
          {overdueTakeout.length > 0 && (
            <div style={alertBox.wrap} role="alert">
              <div style={alertBox.head}><Icon name="alert" size={18} />Para llevar con más de 1h30 sin cerrar · {overdueTakeout.length}</div>
              <div style={alertBox.list}>
                {overdueTakeout.map((c) => (
                  <button key={c.id} style={alertBox.row} onClick={() => router.push(`/staff/comandas/${c.id}?back=${opBack()}`)}>
                    <span style={{ fontWeight: 700, color: C.cream }}>{comandaLabel(c)}</span>
                    <span style={{ color: C.cream }}>{formatMXN(Number(c.total))}</span>
                    <span style={alertBox.time}>hace {elapsedLabel(c.openedAt, nowTs)}</span>
                    <Icon name="chevron" size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "mesas" ? (
            tables === null ? <Spinner /> : (() => {
              const needCaja = occupied.filter((t) => t.comanda!.billPrinted || t.comanda!.status === "AWAITING_PAYMENT");
              const inService = occupied.filter((t) => !(t.comanda!.billPrinted || t.comanda!.status === "AWAITING_PAYMENT"));
              if (occupied.length === 0 && freeTables.length === 0) return <EmptyState text="Sin mesas configuradas." />;
              return (
                <div style={sh.stack}>
                  {needCaja.length > 0 && (
                    <>
                      <SectionLabel tone="gold">Requiere tu caja · {needCaja.length}</SectionLabel>
                      {needCaja.map((t) => {
                        const c = t.comanda!;
                        const pay = c.billPrinted;
                        return (
                          <ActionRow
                            key={t.id}
                            lead={<LeadNum n={t.number} sub="MESA" />}
                            who={`Mesa ${t.number}`}
                            badge={{ text: pay ? "Cuenta impresa" : "Pidió cuenta", color: AWAIT }}
                            meta={`${t.section}${c.waiter ? " · " + c.waiter.fullName : ""} · ${c.folio}`}
                            amount={formatMXN(c.total)}
                            tone={pay ? "pay" : "act"}
                            action={pay
                              ? <button style={rowBtn.pay} onClick={() => setPayTarget(c.id)}><Icon name="card" size={18} />Cobrar</button>
                              : <button style={{ ...rowBtn.print, opacity: printing === c.id ? 0.6 : 1 }} onClick={() => doPrintBill(c.id)} disabled={printing === c.id}><Icon name="printer" size={18} />{printing === c.id ? "Imprimiendo…" : "Imprimir"}</button>}
                          />
                        );
                      })}
                    </>
                  )}
                  {inService.length > 0 && (
                    <>
                      <SectionLabel>En servicio · sin acción</SectionLabel>
                      {inService.map((t) => {
                        const c = t.comanda!;
                        return (
                          <ActionRow
                            key={t.id}
                            lead={<LeadNum n={t.number} sub="MESA" />}
                            who={`Mesa ${t.number}`}
                            badge={{ text: STATUS_LABEL[c.status] ?? c.status, color: STATUS_COLOR[c.status] ?? C.dim }}
                            meta={`${t.section}${c.waiter ? " · " + c.waiter.fullName : ""}`}
                            amount={formatMXN(c.total)}
                            amountDim
                            tone="passive"
                            action={<button style={rowBtn.ver} onClick={() => router.push(`/staff/comandas/${c.id}?back=${opBack()}`)}>Ver<Icon name="chevron" size={16} /></button>}
                          />
                        );
                      })}
                    </>
                  )}
                  {freeTables.length > 0 && (
                    <>
                      <SectionLabel>Libres</SectionLabel>
                      <FreeStrip tables={freeTables} />
                    </>
                  )}
                </div>
              );
            })()
          ) : tab === "llegadas" ? (
            reservations === null ? <Spinner /> :
            reservations.length === 0 ? <EmptyState text="No hay reservas para hoy." /> : (
              <div style={sh.stack}>
                {reservations.map((r) => (
                  <ActionRow
                    key={r.id}
                    lead={<LeadNum n={r.guests} sub="PERS" />}
                    who={`${hhmm(r.date)} · ${r.guestName}`}
                    badge={r.comanda ? { text: "Sentada", color: STATUS_COLOR.IN_SERVICE } : undefined}
                    meta={r.table ? `Mesa ${r.table.number} · ${r.table.section.name}` : r.sectionPreference ? `Pref. ${r.sectionPreference}` : "Sin mesa asignada"}
                    tone="plain"
                    action={r.comanda
                      ? <button style={rowBtn.ver} onClick={() => router.push(`/staff/comandas/${r.comanda!.id}?back=${opBack()}`)}>Ver<Icon name="chevron" size={16} /></button>
                      : <button style={rowBtn.seat} onClick={() => setSeatRes(r)}><Icon name="arrive" size={18} />Sentar</button>}
                  />
                ))}
              </div>
            )
          ) : tab === "llevar" ? (
            <div>
              <button style={{ ...rowBtn.seat, marginBottom: 14 }} onClick={() => setNewAccount(true)}><Icon name="plus" size={18} />Nueva cuenta (para llevar / sin mesa)</button>
              {takeout === null ? <Spinner /> : takeout.length === 0 ? (
                <EmptyState text="Sin cuentas para llevar. Crea una con «Nueva cuenta»." />
              ) : (() => {
                const isBot = (c: Comanda) => (c.channel ?? "STAFF").startsWith("BOT_");
                const needsKitchen = (c: Comanda) => (c.items ?? []).some((i) => i.status === "PENDING"); // aún sin mandar a cocina
                // Pedidos del bot: los que faltan enviar a cocina van primero (lo urgente arriba).
                const botT = takeout.filter(isBot).sort((a, b) => Number(needsKitchen(b)) - Number(needsKitchen(a)));
                const staffT = takeout.filter((c) => !isBot(c));
                // Una fila de cuenta sin mesa, con la acción según en qué punto va del flujo.
                const takeoutRow = (c: Comanda) => {
                  const toKitchen = needsKitchen(c);
                  const printed = isBillPrinted(c); // ticket vigente (se reinicia al reabrir)
                  const needs = printed || c.status === "AWAITING_PAYMENT";
                  const badge = toKitchen
                    ? { text: isBot(c) ? "Nueva" : "Por enviar", color: C.green }
                    : needs
                    ? { text: printed ? "Cuenta impresa" : "Pidió cuenta", color: AWAIT }
                    : { text: STATUS_LABEL[c.status] ?? c.status, color: STATUS_COLOR[c.status] ?? C.dim };
                  return (
                    <ActionRow
                      key={c.id}
                      lead={<LeadIcon name="bag" sub={isBot(c) ? "BOT" : "LLEVAR"} />}
                      who={comandaLabel(c)}
                      badge={badge}
                      meta={c.pickupNote ? `${c.folio} · Recoge ${c.pickupNote}` : c.folio}
                      amount={formatMXN(Number(c.total))}
                      amountDim={!needs && !toKitchen}
                      tone={toKitchen ? "fresh" : printed ? "pay" : needs ? "act" : "passive"}
                      action={toKitchen
                        ? <button style={rowBtn.kitchen} onClick={() => router.push(`/staff/comandas/${c.id}?back=${opBack()}`)}>Ver pedido<Icon name="chevron" size={16} /></button>
                        : printed
                        ? <button style={rowBtn.pay} onClick={() => setPayTarget(c.id)}><Icon name="card" size={18} />Cobrar</button>
                        : needs
                        ? <button style={{ ...rowBtn.print, opacity: printing === c.id ? 0.6 : 1 }} onClick={() => doPrintBill(c.id)} disabled={printing === c.id}><Icon name="printer" size={18} />{printing === c.id ? "Imprimiendo…" : "Imprimir"}</button>
                        : <button style={rowBtn.ver} onClick={() => router.push(`/staff/comandas/${c.id}?back=${opBack()}`)}>Ver<Icon name="chevron" size={16} /></button>}
                    />
                  );
                };
                return (
                  <div style={sh.stack}>
                    {botT.length > 0 && (
                      <>
                        <SectionLabel tone="gold">Pedidos del bot · {botT.length}</SectionLabel>
                        {botT.map(takeoutRow)}
                      </>
                    )}
                    <SectionLabel>Cuentas sin mesa (caja){staffT.length ? ` · ${staffT.length}` : ""}</SectionLabel>
                    {staffT.length > 0 ? staffT.map(takeoutRow) : <EmptyState text="Sin cuentas creadas por caja." />}
                  </div>
                );
              })()}
            </div>
          ) : tab === "monitor" ? (
            <CajaMonitor session={session} cut={cut} />
          ) : (
            <TipsPanel onToast={push} />
          )}
      </StaffShell>

      <SeatModal
        res={seatRes}
        freeTables={freeTables}
        onClose={() => setSeatRes(null)}
        onSeated={(id) => { setSeatRes(null); load(); router.push(`/staff/comandas/${id}?back=${opBack()}`); }}
        onError={(m) => push(m, "error")}
      />

      <NuevaCuentaModal
        open={newAccount}
        waiterId={staff.id}
        onClose={() => setNewAccount(false)}
        onCreated={(id) => { setNewAccount(false); router.push(`/staff/comandas/${id}?back=${opBack()}`); }}
        onError={(m) => push(m, "error")}
      />

      <CashMovementModal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        onDone={() => { setMoveOpen(false); push("Movimiento registrado", "success"); loadSession(); }}
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

      {/* #3 Modal que OBLIGA OK cuando una cuenta para llevar cruza 1h30. Reaparece por cada
          cuenta nueva que se venza; el banner de arriba persiste hasta que se cierre. */}
      <Modal open={unackedTakeout.length > 0} title="Cuentas para llevar demoradas" onClose={() => {}}>
        <p style={{ margin: "0 0 10px", color: C.dim, fontSize: "0.86rem", lineHeight: 1.5 }}>
          Estas cuentas <b style={{ color: C.cream }}>para llevar</b> llevan más de 1h30 sin cerrarse. Revísalas: entrega, cobro o cierre.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {unackedTakeout.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
              <span style={{ color: C.cream, fontWeight: 700 }}>{comandaLabel(c)}</span>
              <span style={{ color: "#e8766b", fontSize: "0.8rem" }}>hace {elapsedLabel(c.openedAt, nowTs)}</span>
              <span style={{ color: C.cream }}>{formatMXN(Number(c.total))}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button style={btn.primary} onClick={() => setAckAlerts((s) => { const n = new Set(s); unackedTakeout.forEach((c) => n.add(c.id)); return n; })}>
            Entendido
          </button>
        </div>
      </Modal>

      <ToastHost toasts={toasts} onClose={dismiss} />
    </>
  );
}

// ─────────────────────────────────────────────── piezas de la bandeja ──

function SectionLabel({ children, tone }: { children: React.ReactNode; tone?: "gold" }) {
  return (
    <div style={sh.sectionRow}>
      <span style={{ ...sh.sectionTx, color: tone === "gold" ? "#c9964a" : C.faint }}>{children}</span>
      <span style={sh.sectionLine} />
    </div>
  );
}

function LeadNum({ n, sub }: { n: number | string; sub: string }) {
  return (<><b style={row.leadNum}>{n}</b><span style={row.leadSub}>{sub}</span></>);
}
function LeadIcon({ name, sub }: { name: IconName; sub: string }) {
  return (<><Icon name={name} size={24} style={{ color: C.cream }} /><span style={row.leadSub}>{sub}</span></>);
}

function ActionRow({ lead, who, badge, meta, amount, amountDim, tone = "plain", action }: {
  lead: React.ReactNode; who: string; badge?: { text: string; color: string };
  meta?: string; amount?: string; amountDim?: boolean; tone?: "pay" | "act" | "fresh" | "passive" | "plain"; action?: React.ReactNode;
}) {
  return (
    <div style={{ ...row.root, ...(tone === "pay" ? row.pay : tone === "act" ? row.act : tone === "fresh" ? row.fresh : {}) }}>
      <div style={row.lead}>{lead}</div>
      <div style={row.info}>
        <div style={row.l1}>
          <span style={{ ...row.who, ...(tone === "passive" ? { color: C.dim } : {}) }}>{who}</span>
          {badge && <Badge text={badge.text} color={badge.color} />}
        </div>
        {meta && <div style={row.meta}>{meta}</div>}
      </div>
      {amount && <div style={{ ...row.amt, ...(amountDim ? { color: C.dim } : {}) }}>{amount}</div>}
      {action}
    </div>
  );
}

function FreeStrip({ tables }: { tables: TableStatus[] }) {
  return (
    <div style={sh.free}>
      {tables.map((t) => (
        <span key={t.id} style={sh.fchip} title={`${t.section} · cap. ${t.capacity}`}>{t.number}</span>
      ))}
      <span style={{ marginLeft: 8 }}>{tables.length} mesa{tables.length === 1 ? "" : "s"} libre{tables.length === 1 ? "" : "s"}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────── Modal: sentar reserva ──
function SeatModal({ res, freeTables, onClose, onSeated, onError }: {
  res: ReservationToday | null; freeTables: TableStatus[];
  onClose: () => void; onSeated: (comandaId: number) => void; onError: (m: string) => void;
}) {
  const [section, setSection] = useState("");
  const [tableId, setTableId] = useState("");
  const [guests, setGuests] = useState(2);
  const [busy, setBusy] = useState(false);
  const [waiters, setWaiters] = useState<{ id: number; fullName: string; role: string }[]>([]);
  const [waiterId, setWaiterId] = useState<number | null>(null);

  // Mesas ofrecibles: las libres + (si la reserva ya trae mesa asignada) esa mesa.
  const options = useMemo(() => {
    if (res?.table && !freeTables.some((t) => t.id === res.table!.id)) {
      return [{ id: res.table.id, number: res.table.number, capacity: 0, section: res.table.section.name, state: "FREE" as const, comanda: null }, ...freeTables];
    }
    return freeTables;
  }, [res, freeTables]);
  const sections = useMemo(() => [...new Set(options.map((t) => t.section))].sort(), [options]);
  const sectionTables = useMemo(() => options.filter((t) => t.section === section).sort((a, b) => a.number - b.number), [options, section]);

  useEffect(() => {
    if (res) {
      setGuests(res.guests || 2);
      setWaiterId(null);
      apiFetch<{ id: number; fullName: string; role: string }[]>("/api/comandas/waiters").then((r) => { if (r.ok) setWaiters(r.data ?? []); });
      if (res.table) { setSection(res.table.section.name); setTableId(res.table.id); }
      else { setSection(""); setTableId(""); }
    }
  }, [res]);

  const seat = async () => {
    if (!res || !tableId || waiterId == null || busy) return;
    setBusy(true);
    const r = await apiFetch<Comanda>("/api/comandas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, guests, reservationId: res.id, waiterId }),
    });
    setBusy(false);
    if (r.ok) onSeated(r.data!.id);
    else onError(r.error ?? "No se pudo abrir la comanda");
  };

  return (
    <Modal open={!!res} title={res ? `Sentar a ${res.guestName}` : ""} onClose={onClose}>
      <label style={fld.label}>1 · Elige el área</label>
      <div style={nc.chips}>
        {sections.map((sec) => (
          <button key={sec} onClick={() => { setSection(sec); setTableId(""); }} style={{ ...nc.chip, ...(section === sec ? nc.chipOn : {}) }}>{sec}</button>
        ))}
      </div>

      {section && (
        <>
          <label style={{ ...fld.label, marginTop: 18 }}>2 · Mesa libre en {section}</label>
          {sectionTables.length === 0 ? (
            <p style={{ color: C.faint, fontSize: "0.82rem" }}>Sin mesas libres en esta área.</p>
          ) : (
            <div style={nc.chips}>
              {sectionTables.map((t) => (
                <button key={t.id} onClick={() => setTableId(t.id)} style={{ ...nc.tableChip, ...(tableId === t.id ? nc.chipOn : {}) }}>
                  <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>Mesa {t.number}</span>
                  {t.capacity ? <span style={{ fontSize: "0.62rem", opacity: 0.75 }}>cap. {t.capacity}</span> : null}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tableId && (
        <>
          <label style={{ ...fld.label, marginTop: 18 }}>3 · Comensales</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button style={stepper} onClick={() => setGuests((g) => Math.max(1, g - 1))}>−</button>
            <span style={{ color: C.cream, fontWeight: 800, fontSize: "1.2rem", minWidth: 36, textAlign: "center" }}>{guests}</span>
            <button style={stepper} onClick={() => setGuests((g) => Math.min(40, g + 1))}>+</button>
          </div>
        </>
      )}

      {tableId && (
        <>
          <label style={{ ...fld.label, marginTop: 18 }}>4 · Mesero que atiende</label>
          {waiters.length === 0 ? (
            <p style={{ color: C.faint, fontSize: "0.82rem" }}>Cargando meseros…</p>
          ) : (
            <div style={nc.chips}>
              {waiters.map((w) => (
                <button key={w.id} onClick={() => setWaiterId(w.id)} style={{ ...nc.chip, ...(waiterId === w.id ? nc.chipOn : {}) }}>{w.fullName}</button>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
        <button style={{ ...btn.primary, opacity: !tableId || waiterId == null || busy ? 0.5 : 1 }} onClick={seat} disabled={!tableId || waiterId == null || busy}>
          {busy ? "Abriendo…" : "Abrir comanda"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────── Modal: cuenta sin mesa ──
function NuevaCuentaModal({ open, waiterId, onClose, onCreated, onError }: {
  open: boolean; waiterId: number;
  onClose: () => void; onCreated: (id: number) => void; onError: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [empId, setEmpId] = useState(""); // #4 ligar a empleado (opcional)
  const [emps, setEmps] = useState<{ id: number; fullName: string; role: string }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setName(""); setEmpId(""); setBusy(false); } }, [open]);
  useEffect(() => {
    if (!open) return;
    apiFetch<{ id: number; fullName: string; role: string }[]>("/api/comandas/credit-staff").then((r) => { if (r.ok) setEmps(r.data ?? []); });
  }, [open]);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const r = await apiFetch<Comanda>("/api/comandas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customName: name.trim(), waiterId }),
    });
    if (!r.ok) { setBusy(false); onError(r.error ?? "No se pudo crear la cuenta"); return; }
    // #4: si se eligió empleado, ligar la cuenta (queda PENDING de aprobación del empleado).
    if (empId) {
      const link = await apiFetch<Comanda>(`/api/comandas/${r.data!.id}/link-employee`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: Number(empId) }),
      });
      if (!link.ok) onError(link.error ?? "Cuenta creada, pero no se pudo ligar al empleado");
    }
    setBusy(false);
    onCreated(r.data!.id);
  };

  return (
    <Modal open={open} title="Nueva cuenta sin mesa" onClose={onClose}>
      <p style={{ margin: "0 0 4px", color: C.dim, fontSize: "0.86rem", lineHeight: 1.5 }}>
        Para llevar, o una cuenta especial sin mesa. Ponle un nombre para identificarla.
      </p>
      <label style={{ ...fld.label, marginTop: 12 }}>Nombre de la cuenta</label>
      <input style={fld.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Para llevar - Juan, Cuenta barra 3" autoFocus />
      <label style={{ ...fld.label, marginTop: 14 }}>Ligar a empleado (opcional)</label>
      <select style={{ ...fld.input, width: "100%" }} value={empId} onChange={(e) => setEmpId(e.target.value)}>
        <option value="">— Sin ligar —</option>
        {emps.map((e) => <option key={e.id} value={e.id}>{e.fullName} · {e.role}</option>)}
      </select>
      {empId && <div style={{ color: C.faint, fontSize: "0.76rem", marginTop: 6 }}>El empleado deberá aprobarla con su PIN antes de que caja pueda cobrarla a crédito.</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
        <button style={{ ...btn.primary, opacity: !name.trim() || busy ? 0.5 : 1 }} onClick={submit} disabled={!name.trim() || busy}>
          {busy ? "Creando…" : "Crear cuenta"}
        </button>
      </div>
    </Modal>
  );
}

// Entrada / salida de efectivo del cajón (no es venta): afecta el efectivo esperado del corte.
function CashMovementModal({ open, onClose, onDone, onError }: {
  open: boolean; onClose: () => void; onDone: () => void; onError: (m: string) => void;
}) {
  const [direction, setDirection] = useState<"IN" | "OUT">("OUT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setDirection("OUT"); setAmount(""); setReason(""); setBusy(false); } }, [open]);

  const amt = Number(amount);
  const valid = Number.isFinite(amt) && amt > 0 && reason.trim().length > 0;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const r = await apiFetch("/api/caja/movements", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction, amount: amt, reason: reason.trim() }),
    });
    setBusy(false);
    if (r.ok) onDone();
    else onError(r.error ?? "No se pudo registrar el movimiento");
  };

  return (
    <Modal open={open} title="Entrada / salida de efectivo" onClose={onClose}>
      <p style={{ margin: "0 0 4px", color: C.dim, fontSize: "0.86rem", lineHeight: 1.5 }}>
        Dinero que ENTRA o SALE del cajón (no es una venta). Ajusta el efectivo esperado del corte y abre el cajón.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {([["OUT", "Salida (retiro)"], ["IN", "Entrada (depósito)"]] as const).map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => setDirection(val)}
            aria-pressed={direction === val}
            style={{ flex: 1, minHeight: 46, borderRadius: 10, border: `1px solid ${direction === val ? C.gold : C.line}`, background: direction === val ? "color-mix(in srgb, #ba843c 16%, transparent)" : "transparent", color: direction === val ? C.gold : C.dim, fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}
          >{lbl}</button>
        ))}
      </div>
      <label style={{ ...fld.label, marginTop: 14 }}>Monto</label>
      <input style={fld.input} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus />
      <label style={{ ...fld.label, marginTop: 12 }}>Motivo</label>
      <input style={fld.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={direction === "OUT" ? "ej. pago a proveedor, compra insumos" : "ej. fondo adicional, depósito"} />
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
        <button style={{ ...btn.primary, opacity: !valid || busy ? 0.5 : 1 }} onClick={submit} disabled={!valid || busy}>
          {busy ? "Registrando…" : "Registrar"}
        </button>
      </div>
    </Modal>
  );
}

const stepper: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 9, border: `1px solid ${C.line}`,
  background: "transparent", color: C.cream, fontSize: "1.3rem", cursor: "pointer",
};

const nc: Record<string, React.CSSProperties> = {
  chips: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    minHeight: 44, padding: "0 16px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent",
    color: C.dim, fontWeight: 700, fontSize: "0.86rem", cursor: "pointer", fontFamily: "inherit",
  },
  tableChip: {
    minWidth: 78, minHeight: 56, padding: "6px 12px", borderRadius: 10, border: `1px solid ${C.line}`,
    background: "transparent", color: C.cream, cursor: "pointer", fontFamily: "inherit",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
  },
  chipOn: { background: C.gold, color: "var(--sl-on-accent)", borderColor: C.gold },
};

// ─── botones de fila (acción única y grande por cuenta) ──────────────────────
const rowBtn: Record<string, React.CSSProperties> = {
  pay: { ...btn.primary, minHeight: 48, minWidth: 132, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 0 },
  seat: { ...btn.primary, minHeight: 48, minWidth: 110, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 0 },
  ver: { ...btn.ghost, minHeight: 48, minWidth: 92, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, flexShrink: 0 },
  print: {
    minHeight: 48, minWidth: 132, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 0,
    padding: "0 18px", borderRadius: 12, border: `1px solid ${AWAIT}`, background: `color-mix(in srgb, ${AWAIT} 16%, transparent)`,
    color: AWAIT, fontWeight: 800, fontSize: "0.88rem", cursor: "pointer", fontFamily: "inherit",
  },
  kitchen: {
    minHeight: 48, minWidth: 156, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 0,
    padding: "0 18px", borderRadius: 12, border: "none", background: C.green, color: "#0f1a15",
    fontWeight: 800, fontSize: "0.88rem", cursor: "pointer", fontFamily: "inherit",
  },
};

// ─── shell (riel + contenido) y filas ────────────────────────────────────────
const alertBox: Record<string, React.CSSProperties> = {
  wrap: { background: "rgba(224,118,107,0.10)", border: "1px solid rgba(224,118,107,0.5)", borderRadius: 12, padding: "12px 14px", margin: "6px 0 14px" },
  head: { display: "flex", alignItems: "center", gap: 8, color: "#e8766b", fontWeight: 800, fontSize: "0.86rem", marginBottom: 8 },
  list: { display: "flex", flexDirection: "column", gap: 6 },
  row: { display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "rgba(0,0,0,0.14)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", color: C.dim },
  time: { marginLeft: "auto", color: "#e8766b", fontSize: "0.78rem", fontWeight: 700 },
};

const sh: Record<string, React.CSSProperties> = {
  kicker: { display: "flex", alignItems: "baseline", gap: 12, margin: "8px 0 4px" },
  h1: { margin: 0, fontSize: "1.15rem", fontWeight: 800, color: C.cream, letterSpacing: "0.01em" },
  sub: { fontSize: "0.8rem", color: C.faint },
  stack: { display: "flex", flexDirection: "column", gap: 9 },
  sectionRow: { display: "flex", alignItems: "center", gap: 12, margin: "22px 0 10px" },
  sectionTx: { fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, whiteSpace: "nowrap" },
  sectionLine: { flex: 1, height: 1, background: C.line },
  free: { display: "flex", flexWrap: "wrap", gap: 9, alignItems: "center", padding: "13px 16px", border: "1px dashed rgba(255,255,255,0.16)", borderRadius: 14, color: C.faint, fontSize: "0.8rem" },
  fchip: { minWidth: 46, minHeight: 46, borderRadius: 11, border: `1px solid ${C.line}`, background: C.panel, color: C.cream, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" },
};

const row: Record<string, React.CSSProperties> = {
  root: { display: "flex", alignItems: "center", gap: 16, padding: "13px 16px", border: "1px solid", borderColor: C.line, borderRadius: 14, background: C.panel },
  pay: { background: `color-mix(in srgb, ${C.gold} 11%, ${C.panel})`, borderColor: `color-mix(in srgb, ${C.gold} 42%, ${C.line})` },
  act: { background: `color-mix(in srgb, ${AWAIT} 10%, ${C.panel})`, borderColor: `color-mix(in srgb, ${AWAIT} 40%, ${C.line})` },
  fresh: { background: `color-mix(in srgb, ${C.green} 13%, ${C.panel})`, borderColor: `color-mix(in srgb, ${C.green} 46%, ${C.line})` },
  lead: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 66, height: 54, borderRadius: 12, background: C.panel2, border: `1px solid ${C.line}`, color: C.cream, flexShrink: 0 },
  leadNum: { fontSize: "1.3rem", fontWeight: 900, lineHeight: 1 },
  leadSub: { fontSize: "0.55rem", color: C.faint, letterSpacing: "0.07em", marginTop: 3 },
  info: { flex: 1, minWidth: 0 },
  l1: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  who: { fontWeight: 800, fontSize: "1rem", color: C.cream },
  meta: { color: C.faint, fontSize: "0.78rem", marginTop: 4 },
  amt: { fontSize: "1.14rem", fontWeight: 900, whiteSpace: "nowrap", color: C.cream },
};
