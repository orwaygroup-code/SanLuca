"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import {
  C, Spinner, EmptyState, Badge, Modal, btn, fld,
  useToasts, ToastHost, useStaffLogout, usePoll,
} from "@/components/staff/ui";
import { StaffShell } from "@/components/staff/StaffShell";
import { Icon } from "@/components/staff/icons";
import { apiFetch } from "@/components/staff/types";
import { DatePicker } from "@/components/ui/DatePicker";
import { NewReservationModal } from "@/components/reservation/NewReservationModal";
import { EditReservationModal } from "@/components/reservation/EditReservationModal";
import { MoveTableModal } from "@/components/reservation/MoveTableModal";
import type { Reservation, TableSelection } from "@/components/reservation/types";

// ── Estado de reservas (idéntico a /admin) ─────────────────────────────────
const RES_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "ESPERA PAGO",
  PENDING:     "PENDIENTE",
  CONFIRMED:   "CONFIRMADA",
  IN_PROGRESS: "EN CURSO",
  DELAYED:     "RETRASO",
  CANCELLED:   "CANCELADA",
  COMPLETED:   "COMPLETADA",
  NO_SHOW:     "NO SE PRESENTÓ",
};
const RES_STATUS_COLOR: Record<string, string> = {
  PENDING_PAYMENT: "#e09632",
  PENDING:     "#c9964a",
  CONFIRMED:   "#63aede",
  IN_PROGRESS: "#5cbf60",
  DELAYED:     "#e8766b",
  CANCELLED:   "rgba(255,255,255,0.6)",
  COMPLETED:   "rgba(255,255,255,0.55)",
  NO_SHOW:     "#d95f4a",
};
// Transiciones de estado — mismo mapa que app/admin/page.tsx.
const NEXT_STATUSES: Record<string, { label: string; value: string }[]> = {
  PENDING:     [{ label: "Confirmar", value: "CONFIRMED" }, { label: "Cancelar", value: "CANCELLED" }],
  CONFIRMED:   [{ label: "En curso", value: "IN_PROGRESS" }, { label: "Retraso", value: "DELAYED" }, { label: "No se presentó", value: "NO_SHOW" }],
  IN_PROGRESS: [{ label: "Completar", value: "COMPLETED" }],
  DELAYED:     [{ label: "En curso", value: "IN_PROGRESS" }, { label: "No se presentó", value: "NO_SHOW" }],
  COMPLETED:   [],
  CANCELLED:   [],
  NO_SHOW:     [],
};
const NO_ACTIONS = ["CANCELLED", "NO_SHOW", "COMPLETED"]; // sin editar / mover mesa
const SECTIONS = ["Todas", "Terraza", "Planta Alta", "Salón", "Privado"];

const MX_TZ = "America/Mexico_City";
function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: MX_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}
function fmtDateShort(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: MX_TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

/** Gestión de reservas (staff / hostess) — crear, editar, mover mesa, cambiar estado. */
export default function ReservasPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const { toasts, push, dismiss } = useToasts();

  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [section, setSection] = useState("Todas");
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [editTarget, setEditTarget] = useState<Reservation | null>(null);
  const [moveTarget, setMoveTarget] = useState<Reservation | null>(null);
  const [noteTarget, setNoteTarget] = useState<Reservation | null>(null);

  const allowed = staff && ["OPERATION", "CAPTAIN", "MANAGER"].includes(staff.role);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (section !== "Todas") params.set("section", section);
    if (date) params.set("date", date);
    if (search) params.set("search", search);
    const qs = params.toString();
    const r = await apiFetch<Reservation[]>(`/api/staff/reservations${qs ? `?${qs}` : ""}`);
    if (r.ok) setReservations(r.data!);
    else { setReservations([]); push(r.error ?? "Error al cargar reservas", "error"); }
  }, [section, date, search, push]);

  useEffect(() => {
    if (!loading && !staff) { router.replace("/staff/login?next=/staff/reservas"); return; }
    if (staff && !allowed) { router.replace("/staff/login"); return; }
    if (staff && allowed) load();
  }, [loading, staff, allowed, router, load]);

  usePoll(load, 8000, !!allowed); // refresco en vivo de reservas

  // ── Acciones (mismos bodies que /admin, endpoints de staff) ──────────────
  const createReservation = async (data: {
    guestName: string; guestPhone: string; date: string; time: string; guests: number;
    sectionPreference?: string; notes?: string; occasion?: string; isLargeGroup?: boolean;
    tableId?: string; linkedTableId?: string; thirdTableId?: string; fourthTableId?: string;
  }) => {
    const r = await apiFetch<Reservation>("/api/staff/reservations", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(r.error ?? "No se pudo crear la reserva");
    push("Reserva creada", "success");
    load();
  };

  const editReservation = async (id: string, data: {
    date: string; time: string; guests: number; guestName: string; guestPhone: string;
    sectionPreference?: string; tableId?: string; linkedTableId?: string; thirdTableId?: string;
    fourthTableId?: string; notes?: string; occasion?: string;
  }) => {
    const r = await apiFetch<Reservation>(`/api/staff/reservations/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "edit-reservation", ...data }),
    });
    if (!r.ok) throw new Error(r.error ?? "No se pudo editar la reserva");
    push("Reserva actualizada", "success");
    load();
  };

  // Mapea la TableSelection del modal al body PATCH move-table (igual que admin.moveTable).
  const moveTable = async (id: string, selection: TableSelection | null, sectionPreference: string, forceAssign = false) => {
    const r = await apiFetch<Reservation>(`/api/staff/reservations/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "move-table",
        tableId: selection?.tableId ?? null,
        linkedTableId: selection?.linkedTableId ?? null,
        thirdTableId: selection?.thirdTableId ?? null,
        fourthTableId: selection?.fourthTableId ?? null,
        sectionPreference,
        forceAssign,
      }),
    });
    if (!r.ok) throw new Error(r.error ?? "No se pudo mover la mesa");
    push("Mesa actualizada", "success");
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    const r = await apiFetch<Reservation>(`/api/staff/reservations/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    setUpdating(null);
    if (r.ok) { push("Estado actualizado", "success"); load(); }
    else push(r.error ?? "No se pudo cambiar el estado", "error");
  };

  if (loading || !staff || !allowed) return <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center" }}><Spinner /></div>;

  const hasFilters = section !== "Todas" || !!date || !!search;

  return (
    <>
      <StaffShell active="reservas" onRefresh={load} onLogout={logout} userName={staff.fullName} role={staff.role} maxWidth={1200}>
        <div style={rv.head}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={rv.h1}>Reservas</h1>
            {reservations && <span style={rv.sub}>{reservations.length} {reservations.length === 1 ? "reserva" : "reservas"}</span>}
          </div>
          <button style={rv.new} onClick={() => setShowNew(true)}><Icon name="plus" size={18} />Nueva reserva</button>
        </div>

        {/* ── Filtros ── */}
        <div style={rv.filters}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SECTIONS.map((s) => (
              <button key={s} onClick={() => setSection(s)} style={{ ...chip, ...(section === s ? chipOn : {}) }}>{s}</button>
            ))}
          </div>
          <div style={rv.filterRow}>
            <DatePicker value={date} onChange={setDate} placeholder="Todas las fechas (hoy en adelante)" style={{ flex: "1 1 220px" }} />
            <div style={{ display: "flex", gap: 8, flex: "1 1 220px" }}>
              <input
                style={{ ...fld.input, flex: 1 }}
                placeholder="Buscar nombre o celular…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") load(); }}
              />
              <button style={btn.ghost} onClick={load}>Buscar</button>
            </div>
            {hasFilters && (
              <button style={{ ...btn.ghost, color: C.faint }} onClick={() => { setSection("Todas"); setDate(""); setSearch(""); }}>
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* ── Lista ── */}
        {reservations === null ? <Spinner /> :
        reservations.length === 0 ? <EmptyState text="No hay reservas con esos filtros." /> : (
          <div style={rv.grid}>
            {reservations.map((r) => {
              const locked = NO_ACTIONS.includes(r.status);
              return (
                <div key={r.id} style={rv.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ color: C.cream, fontWeight: 800 }}>{fmtDateShort(r.date)} · {fmtTime(r.date)}</span>
                    <Badge text={RES_STATUS_LABEL[r.status] ?? r.status} color={RES_STATUS_COLOR[r.status] ?? C.dim} />
                  </div>

                  <div style={{ color: C.cream, fontSize: "1.02rem", fontWeight: 700, marginTop: 8 }}>{r.guestName}</div>
                  <div style={{ color: C.dim, fontSize: "0.8rem", marginTop: 2 }}>
                    {r.guestPhone || "sin celular"} · {r.guests} pers
                  </div>
                  <div style={{ color: C.faint, fontSize: "0.78rem", marginTop: 2 }}>
                    {r.table ? `Mesa ${r.table.number} · ${r.table.section.name}` : r.sectionPreference ? `pref. ${r.sectionPreference}` : "Sin mesa asignada"}
                  </div>

                  {r.occasion && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.gold, fontSize: "0.78rem", marginTop: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: C.gold, display: "inline-block", flexShrink: 0 }} />
                      {r.occasion}
                    </div>
                  )}
                  {r.notes && (
                    <button style={{ ...miniOutline, borderColor: C.border, color: C.gold, marginTop: 8 }} onClick={() => setNoteTarget(r)}>
                      Ver nota…
                    </button>
                  )}

                  <div style={rv.cardActions}>
                    {!locked && <button style={miniEdit} onClick={() => setEditTarget(r)}>Editar</button>}
                    {!locked && <button style={miniMove} onClick={() => setMoveTarget(r)}>Cambiar mesa</button>}
                    {(NEXT_STATUSES[r.status] ?? []).map((a) => (
                      <button key={a.value} style={miniStatus} disabled={updating === r.id} onClick={() => updateStatus(r.id, a.value)}>
                        {updating === r.id ? "…" : a.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </StaffShell>

      {/* ── Modales ── */}
      {showNew && (
        <NewReservationModal
          onClose={() => setShowNew(false)}
          onCreate={async (data) => { await createReservation(data); setShowNew(false); }}
        />
      )}
      {editTarget && (
        <EditReservationModal
          reservation={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={async (data) => { await editReservation(editTarget.id, data); setEditTarget(null); }}
        />
      )}
      {moveTarget && (
        <MoveTableModal
          reservation={moveTarget}
          userId=""
          onClose={() => setMoveTarget(null)}
          onMove={async (selection, sectionPref, forceAssign) => { await moveTable(moveTarget.id, selection, sectionPref, forceAssign); setMoveTarget(null); }}
        />
      )}

      <Modal open={!!noteTarget} title={noteTarget ? `Nota · ${noteTarget.guestName}` : ""} onClose={() => setNoteTarget(null)}>
        <p style={{ margin: 0, color: C.cream, fontSize: "0.92rem", lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {noteTarget?.notes}
        </p>
      </Modal>

      <ToastHost toasts={toasts} onClose={dismiss} />
    </>
  );
}

const chip: React.CSSProperties = {
  minHeight: 40, padding: "0 14px", borderRadius: 999, border: `1px solid ${C.line}`, background: "transparent",
  color: C.dim, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit",
};
const chipOn: React.CSSProperties = { background: C.gold, color: "#16201f", borderColor: C.gold };

const miniOutline: React.CSSProperties = {
  padding: "7px 11px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent",
  color: C.dim, fontSize: "0.76rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
const miniEdit: React.CSSProperties = { ...miniOutline, borderColor: C.gold, color: C.gold };
const miniMove: React.CSSProperties = { ...miniOutline, borderColor: C.blue, color: C.blue };
const miniStatus: React.CSSProperties = { ...miniOutline, borderColor: C.gold, color: C.gold, fontWeight: 700 };

const rv: Record<string, React.CSSProperties> = {
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "8px 0 16px" },
  h1: { margin: 0, fontSize: "1.15rem", fontWeight: 800, color: C.cream, letterSpacing: "0.01em" },
  sub: { fontSize: "0.8rem", color: C.faint },
  new: { ...btn.primary, minHeight: 44, display: "inline-flex", alignItems: "center", gap: 8 },
  filters: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 },
  filterRow: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 },
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 16px 18px" },
  cardActions: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 },
};
