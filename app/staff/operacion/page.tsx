"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import {
  C, StaffHeader, Spinner, EmptyState, Badge, Modal, ConfirmModal, btn, fld, formatMXN,
  STATUS_LABEL, STATUS_COLOR, useToasts, ToastHost, useStaffLogout,
} from "@/components/staff/ui";
import { apiFetch, type TableStatus, type ReservationToday, type Comanda } from "@/components/staff/types";
import { GoldSelect } from "@/components/ui/GoldSelect";

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

  const [tab, setTab] = useState<"reservas" | "mesas">("reservas");
  const [reservations, setReservations] = useState<ReservationToday[] | null>(null);
  const [tables, setTables] = useState<TableStatus[] | null>(null);
  const [seatRes, setSeatRes] = useState<ReservationToday | null>(null);
  const [closeTarget, setCloseTarget] = useState<TableStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const allowed = staff && ["OPERATION", "CAPTAIN", "MANAGER"].includes(staff.role);

  const load = useCallback(async () => {
    const [res, tbl] = await Promise.all([
      apiFetch<ReservationToday[]>("/api/comandas/reservations-today"),
      apiFetch<TableStatus[]>("/api/comandas/tables-status"),
    ]);
    if (res.ok) setReservations(res.data!); else { setReservations([]); push(res.error ?? "Error reservas", "error"); }
    if (tbl.ok) setTables(tbl.data!); else { setTables([]); push(tbl.error ?? "Error mesas", "error"); }
  }, [push]);

  useEffect(() => {
    if (!loading && !staff) { router.replace("/staff/login?next=/staff/operacion"); return; }
    if (staff && !allowed) { router.replace("/staff/login"); return; }
    if (staff && allowed) load();
  }, [loading, staff, allowed, router, load]);

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
        right={<button style={btn.ghost} onClick={load}>↻</button>}
      />

      <div style={page.tabs}>
        <button style={{ ...page.tab, ...(tab === "reservas" ? page.tabOn : {}) }} onClick={() => setTab("reservas")}>Reservas de hoy</button>
        <button style={{ ...page.tab, ...(tab === "mesas" ? page.tabOn : {}) }} onClick={() => setTab("mesas")}>Mesas</button>
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
        ) : (
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
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button style={{ ...btn.ghost, padding: "7px 12px", fontSize: "0.78rem" }} onClick={() => router.push(`/staff/comandas/${t.comanda!.id}`)}>Ver</button>
                        <button style={{ ...btn.primary, padding: "7px 12px", fontSize: "0.78rem" }} onClick={() => setCloseTarget(t)}>Cobrar / cerrar</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            )
          )
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
        title="Cerrar comanda"
        message={closeTarget?.comanda ? `Marcar ${closeTarget.comanda.folio} (Mesa ${closeTarget.number}) como PAGADA y liberar la mesa. La caja cobra por fuera. ¿Continuar?` : ""}
        confirmLabel="Cerrar (pagada)"
        busy={busy}
        onConfirm={doClose}
        onCancel={() => setCloseTarget(null)}
      />

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
