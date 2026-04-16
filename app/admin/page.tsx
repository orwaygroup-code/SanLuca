"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TableMap } from "@/components/reservation/TableMap";
import type { AvailabilityData, TableSelection } from "@/components/reservation/types";

// ── Types ──────────────────────────────────────────────────────────────
interface Reservation {
    id:                string;
    guestName:         string;
    guestPhone:        string;
    date:              string;
    guests:            number;
    sectionPreference: string | null;
    occasion:          string | null;
    notes:             string | null;
    status:            string;
    paymentStatus:     string;
    checkedInAt:       string | null;
    qrToken:           string;
    table:             { number: number; section: { name: string } } | null;
    user:              { name: string; email: string; phone: string };
}

// ── Status config ──────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
    PENDING:     "PENDIENTE",
    CONFIRMED:   "CONFIRMADA",
    IN_PROGRESS: "EN CURSO",
    DELAYED:     "RETRASO",
    CANCELLED:   "CANCELADA",
    COMPLETED:   "COMPLETADA",
    NO_SHOW:     "NO SE PRESENTÓ",
};
const STATUS_COLOR: Record<string, string> = {
    PENDING:     "#ba843c",
    CONFIRMED:   "#4a9eca",
    IN_PROGRESS: "#4caf50",
    DELAYED:     "#e05555",
    CANCELLED:   "rgba(255,255,255,0.3)",
    COMPLETED:   "rgba(255,255,255,0.25)",
    NO_SHOW:     "#c0392b",
};

const STATUS_GROUPS: { key: string; label: string; color: string }[] = [
    { key: "IN_PROGRESS", label: "EN CURSO",            color: "#4caf50" },
    { key: "DELAYED",     label: "RETRASO",              color: "#e05555" },
    { key: "PENDING",     label: "PENDIENTES",           color: "#ba843c" },
    { key: "CONFIRMED",   label: "CONFIRMADAS",          color: "#4a9eca" },
    { key: "COMPLETED",   label: "COMPLETADAS",          color: "rgba(255,255,255,0.28)" },
    { key: "NO_SHOW",     label: "NO SE PRESENTARON",    color: "rgba(192,57,43,0.7)" },
    { key: "CANCELLED",   label: "CANCELADAS",           color: "rgba(255,255,255,0.18)" },
];

const DELETABLE_STATUSES = ["CANCELLED", "NO_SHOW", "COMPLETED"];

const SECTIONS = ["Todas", "Terraza", "Planta Alta", "Salón", "Privado"];
const NEXT_STATUSES: Record<string, { label: string; value: string }[]> = {
    PENDING:     [{ label: "Confirmar", value: "CONFIRMED" }, { label: "Cancelar", value: "CANCELLED" }],
    CONFIRMED:   [{ label: "En curso",  value: "IN_PROGRESS" }, { label: "Retraso", value: "DELAYED" }, { label: "No se presentó", value: "NO_SHOW" }],
    IN_PROGRESS: [{ label: "Completar", value: "COMPLETED" }],
    DELAYED:     [{ label: "En curso",  value: "IN_PROGRESS" }, { label: "No se presentó", value: "NO_SHOW" }],
    COMPLETED:   [],
    CANCELLED:   [],
    NO_SHOW:     [],
};

// ── Helpers ────────────────────────────────────────────────────────────
const MX_TZ = "America/Mexico_City";

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-MX", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        timeZone: MX_TZ,
    }).toUpperCase();
}
function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: MX_TZ });
}

interface DateGroup {
    key: string;
    label: string;
    isToday: boolean;
    items: Reservation[];
    totalGuests: number;
}

function groupByDate(reservations: Reservation[]): DateGroup[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
        const key = r.date.slice(0, 10);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
    }

    return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, items]) => {
            const d = new Date(`${key}T00:00:00`);
            const isToday = d.getTime() === today.getTime();
            const label = isToday
                ? "HOY — " + fmtDate(`${key}T12:00:00`)
                : fmtDate(`${key}T12:00:00`);
            const totalGuests = items.reduce((sum, r) => sum + r.guests, 0);
            return { key, label, isToday, items, totalGuests };
        });
}

// ── Main component ─────────────────────────────────────────────────────
export default function AdminPage() {
    const router = useRouter();
    const [userId, setUserId]             = useState<string | null>(null);
    const [userRole, setUserRole]         = useState<string | null>(null);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading]           = useState(true);
    const [section, setSection]           = useState("Todas");
    const [date, setDate]                 = useState("");
    const [search, setSearch]             = useState("");
    const [updating, setUpdating]         = useState<string | null>(null);
    const [deleting, setDeleting]         = useState<string | null>(null);
    const [onlyPending, setOnlyPending]   = useState(false);
    const [moveTarget, setMoveTarget]     = useState<Reservation | null>(null);
    const [editTarget, setEditTarget]     = useState<Reservation | null>(null);

    useEffect(() => {
        const uid  = localStorage.getItem("userId");
        const role = localStorage.getItem("userRole");
        if (!uid || !["ADMIN", "HOSTES"].includes(role ?? "")) { router.push("/login?mode=login"); return; }
        setUserId(uid);
        setUserRole(role);
    }, [router]);

    const fetchReservations = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        const params = new URLSearchParams();
        if (section !== "Todas") params.set("section", section);
        if (date)   params.set("date",   date);
        if (search) params.set("search", search);
        const res  = await fetch(`/api/admin/reservations?${params}`, { headers: { "x-user-id": userId } });
        const data = await res.json();
        if (data.success) setReservations(data.data);
        setLoading(false);
    }, [userId, section, date, search]);

    useEffect(() => { fetchReservations(); }, [fetchReservations]);

    const updateStatus = async (id: string, status: string) => {
        if (!userId) return;
        setUpdating(id);
        await fetch(`/api/admin/reservations/${id}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": userId },
            body:    JSON.stringify({ status }),
        });
        await fetchReservations();
        setUpdating(null);
    };

    const deleteReservation = async (id: string) => {
        if (!userId) return;
        if (!confirm("¿Eliminar esta reserva permanentemente?")) return;
        setDeleting(id);
        await fetch(`/api/admin/reservations/${id}`, {
            method:  "DELETE",
            headers: { "x-user-id": userId },
        });
        await fetchReservations();
        setDeleting(null);
    };

    const editReservation = async (id: string, data: {
        date: string; time: string; guests: number;
        guestName: string; guestPhone: string; sectionPreference?: string;
        tableId?: string; linkedTableId?: string; thirdTableId?: string;
        notes?: string; occasion?: string;
    }) => {
        if (!userId) return;
        const res = await fetch(`/api/admin/reservations/${id}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": userId },
            body:    JSON.stringify({ action: "edit-reservation", ...data }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        await fetchReservations();
    };

    const moveTable = async (id: string, selection: TableSelection | null, sectionPreference: string) => {
        if (!userId) return;
        const res = await fetch(`/api/admin/reservations/${id}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": userId },
            body: JSON.stringify({
                action:            "move-table",
                tableId:           selection?.tableId ?? null,
                linkedTableId:     selection?.linkedTableId ?? null,
                thirdTableId:      selection?.thirdTableId ?? null,
                sectionPreference,
            }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        await fetchReservations();
    };

    const sectionIdx = SECTIONS.indexOf(section);
    const thumbLeft  = `calc(${(sectionIdx / SECTIONS.length) * 100}% + 4px)`;
    const thumbWidth = `calc(${100 / SECTIONS.length}% - 8px)`;

    if (!userId) return null;

    const pendingCount = reservations.filter((r) => r.status === "PENDING").length;
    const displayed    = reservations.filter((r) =>
        !onlyPending || r.status === "PENDING"
    );
    const groups = groupByDate(displayed);

    return (
        <div className="adm-page">
            {/* ── Header ── */}
            <div className="adm-header">
                <h1 className="adm-title">
                    <span className="adm-title--gold">RESERVACIONES</span>
                    {" "}<span className="adm-title--white">{userRole === "ADMIN" ? "ADMIN" : "HOSTESS"}</span>
                </h1>
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        onClick={() => router.push("/admin/mapa")}
                        style={{ padding: "8px 14px", background: "rgba(186,132,60,0.12)", border: "1px solid rgba(186,132,60,0.35)", borderRadius: 8, color: "#ba843c", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em" }}
                    >
                        🗺 Mapa
                    </button>
                    <button className="adm-logout" onClick={() => { localStorage.clear(); router.push("/login?mode=login"); }}>
                        Salir
                    </button>
                </div>
            </div>

            {/* ── Badge pendientes ── */}
            {pendingCount > 0 && (
                <button
                    className={`adm-pending-badge${onlyPending ? " adm-pending-badge--active" : ""}`}
                    onClick={() => setOnlyPending((v) => !v)}
                >
                    <span className="adm-pending-badge__count">{pendingCount}</span>
                    {pendingCount === 1 ? "RESERVA POR CONFIRMAR" : "RESERVAS POR CONFIRMAR"}
                    {onlyPending && <span className="adm-pending-badge__clear"> · Ver todas</span>}
                </button>
            )}

            {/* ── Filters ── */}
            <div className="adm-filters">
                <div className="adm-switch-track">
                    <div className="adm-switch-thumb" style={{ left: thumbLeft, width: thumbWidth }} />
                    {SECTIONS.map((s) => (
                        <button
                            key={s}
                            className={`adm-switch-btn${section === s ? " adm-switch-btn--active" : ""}`}
                            onClick={() => setSection(s)}
                        >{s}</button>
                    ))}
                </div>

                <input
                    className="adm-date-input"
                    type="date"
                    value={date}
                    style={{ colorScheme: "dark" }}
                    onChange={(e) => setDate(e.target.value)}
                />

                <div className="adm-search-wrap">
                    <input
                        className="adm-search-input"
                        placeholder="Buscar nombre o celular…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && fetchReservations()}
                    />
                    <button className="adm-search-btn" onClick={fetchReservations}>🔍 Buscar</button>
                </div>

                {(section !== "Todas" || date || search) && (
                    <button className="adm-clear-btn" onClick={() => { setSection("Todas"); setDate(""); setSearch(""); }}>
                        ✕ Limpiar filtros
                    </button>
                )}
            </div>

            {/* ── Content ── */}
            {loading ? (
                <div className="adm-empty">Cargando reservas…</div>
            ) : groups.length === 0 ? (
                <div className="adm-empty">No hay reservas con esos filtros.</div>
            ) : (
                <div>
                    {groups.map(({ key, label, isToday, items, totalGuests }) => {
                        const countByStatus: Record<string, number> = {};
                        for (const sg of STATUS_GROUPS) {
                            countByStatus[sg.key] = items.filter((r) => r.status === sg.key).length;
                        }

                        // Active chips: only show statuses that have reservations and are not terminal
                        const activeChips = STATUS_GROUPS.filter(
                            (sg) => countByStatus[sg.key] > 0 && !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(sg.key)
                        );

                        return (
                            <div key={key} className="adm-date-block">
                                {/* Date separator */}
                                <div className="adm-date-separator">
                                    <span className={`adm-date-separator__label${isToday ? " adm-date-separator__label--today" : ""}`}>
                                        {label}
                                    </span>
                                </div>

                                {/* Day summary */}
                                <div className="adm-day-summary">
                                    <span className="adm-day-total">
                                        {items.length} {items.length === 1 ? "RESERVA" : "RESERVAS"}
                                        <span className="adm-day-guests"> · {totalGuests} PERSONAS</span>
                                    </span>
                                    {activeChips.length > 0 && (
                                        <div className="adm-day-chips">
                                            {activeChips.map((sg) => (
                                                <span
                                                    key={sg.key}
                                                    className="adm-chip"
                                                    style={{ borderColor: sg.color, color: sg.color }}
                                                >
                                                    {countByStatus[sg.key]} {sg.label}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Status sub-sections */}
                                {STATUS_GROUPS.map(({ key: sKey, label: sLabel, color }) => {
                                    const group = items.filter((r) => r.status === sKey);
                                    if (group.length === 0) return null;
                                    return (
                                        <div key={sKey} className="adm-status-section">
                                            <div className="adm-status-header">
                                                <span className="adm-status-dot" style={{ background: color }} />
                                                <span className="adm-status-name" style={{ color }}>{sLabel}</span>
                                                <span className="adm-status-count" style={{ color }}>
                                                    {group.length}
                                                </span>
                                            </div>
                                            <div className="adm-grid">
                                                {group.map((r) => (
                                                    <div key={r.id} className="adm-card">
                                                        <div
                                                            className="adm-badge"
                                                            style={{ borderColor: STATUS_COLOR[r.status], color: STATUS_COLOR[r.status] }}
                                                        >
                                                            {STATUS_LABEL[r.status] ?? r.status}
                                                        </div>

                                                        <div className="adm-card-date">{fmtDate(r.date)}</div>
                                                        <div className="adm-card-time">{fmtTime(r.date)}</div>

                                                        <div className="adm-details">
                                                            <Row label="TITULAR"  val={r.guestName} />
                                                            <Row label="CELULAR"  val={r.guestPhone} />
                                                            <Row label="PERSONAS" val={String(r.guests)} />
                                                            <Row label="SECCIÓN"  val={r.sectionPreference ?? "—"} />
                                                            <Row
                                                                label="MESA"
                                                                val={r.table ? `#${r.table.number} - ${r.table.section.name.toUpperCase()}` : "Sin asignar"}
                                                            />
                                                            <Row
                                                                label="PAGO"
                                                                val={r.paymentStatus === "PAID"    ? "Pagado"
                                                                   : r.paymentStatus === "UNPAID"  ? "Pendiente"
                                                                   : r.paymentStatus === "PARTIAL" ? "Parcial" : "Reembolsado"}
                                                            />
                                                        </div>

                                                        <div className="adm-actions">
                                                            <a
                                                                className="adm-btn-outline"
                                                                href={`/checkin/${r.qrToken}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                Ver QR / Check-in
                                                            </a>
                                                            {!DELETABLE_STATUSES.includes(r.status) && (
                                                                <button
                                                                    className="adm-btn-outline"
                                                                    onClick={() => setEditTarget(r)}
                                                                    style={{ borderColor: "rgba(186,132,60,0.5)", color: "#ba843c" }}
                                                                >
                                                                    Editar
                                                                </button>
                                                            )}
                                                            {!DELETABLE_STATUSES.includes(r.status) && (
                                                                <button
                                                                    className="adm-btn-outline"
                                                                    onClick={() => setMoveTarget(r)}
                                                                    style={{ borderColor: "rgba(74,158,202,0.5)", color: "#4a9eca" }}
                                                                >
                                                                    Cambiar Mesa
                                                                </button>
                                                            )}
                                                            {(NEXT_STATUSES[r.status] ?? []).map((action) => (
                                                                <button
                                                                    key={action.value}
                                                                    className="adm-btn-gold"
                                                                    disabled={updating === r.id}
                                                                    onClick={() => updateStatus(r.id, action.value)}
                                                                >
                                                                    {updating === r.id ? "…" : action.label.toUpperCase()}
                                                                </button>
                                                            ))}
                                                            {DELETABLE_STATUSES.includes(r.status) && (
                                                                <button
                                                                    className="adm-btn-delete"
                                                                    disabled={deleting === r.id}
                                                                    onClick={() => deleteReservation(r.id)}
                                                                >
                                                                    {deleting === r.id ? "…" : "🗑 Eliminar"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}
            {/* ── Modal cambiar mesa ── */}
            {moveTarget && (
                <MoveTableModal
                    reservation={moveTarget}
                    userId={userId}
                    onClose={() => setMoveTarget(null)}
                    onMove={async (selection, sectionPref) => {
                        await moveTable(moveTarget.id, selection, sectionPref);
                        setMoveTarget(null);
                    }}
                />
            )}
            {/* ── Modal editar reserva ── */}
            {editTarget && (
                <EditReservationModal
                    reservation={editTarget}
                    onClose={() => setEditTarget(null)}
                    onSave={async (data) => {
                        await editReservation(editTarget.id, data);
                        setEditTarget(null);
                    }}
                />
            )}
        </div>
    );
}

function Row({ label, val }: { label: string; val: string }) {
    return (
        <div className="adm-row">
            <span className="adm-row-label">{label}:</span>
            <span className="adm-row-val">{val}</span>
        </div>
    );
}

// ── Modal Cambiar Mesa ─────────────────────────────────────────────────────
const MODAL_SECTIONS = ["Terraza", "Planta Alta", "Salón", "Privado"] as const;

function MoveTableModal({
    reservation,
    userId,
    onClose,
    onMove,
}: {
    reservation: Reservation;
    userId: string;
    onClose: () => void;
    onMove: (selection: TableSelection | null, sectionPref: string) => Promise<void>;
}) {
    const date    = reservation.date.slice(0, 10);
    const time    = new Date(reservation.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
    const initSec = (reservation.sectionPreference ?? "Terraza") as typeof MODAL_SECTIONS[number];

    const [selectedSection, setSelectedSection] = useState<string>(initSec);
    const [availability, setAvailability]       = useState<AvailabilityData | null>(null);
    const [selection, setSelection]             = useState<TableSelection | null>(null);
    const [loading, setLoading]                 = useState(false);
    const [error, setError]                     = useState<string | null>(null);
    const [saving, setSaving]                   = useState(false);

    const fetchAvailability = useCallback(async (sec: string) => {
        setLoading(true);
        setError(null);
        setSelection(null);
        setAvailability(null);
        try {
            const params = new URLSearchParams({ section: sec, date, time, guests: String(reservation.guests) });
            const res  = await fetch(`/api/reservations/available-tables?${params}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            // Forzar que la mesa actual quede disponible visualmente (ya se excluye en el backend)
            const av: AvailabilityData = data.data;
            setAvailability(av);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Error al buscar mesas");
        } finally {
            setLoading(false);
        }
    }, [date, time, reservation.guests]);

    useEffect(() => { fetchAvailability(selectedSection); }, [selectedSection, fetchAvailability]);

    const isLargeGroupReady = !!(availability?.isLargeGroup && availability?.hasAvailability);

    const handleConfirm = async () => {
        if (!selection && !isLargeGroupReady) return;
        setSaving(true);
        setError(null);
        try {
            await onMove(selection, selectedSection);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Error al mover mesa");
            setSaving(false);
        }
    };

    const selLabel = selection
        ? selection.thirdTableNumber
            ? `M${selection.tableNumber} + M${selection.linkedTableNumber} + M${selection.thirdTableNumber}`
            : selection.linkedTableNumber
            ? `M${selection.tableNumber} + M${selection.linkedTableNumber}`
            : `Mesa M${selection.tableNumber}`
        : null;

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 1000,
                background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "16px",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                background: "#1a2628", border: "1px solid rgba(186,132,60,0.2)",
                borderRadius: 16, width: "100%", maxWidth: 680,
                maxHeight: "90vh", overflowY: "auto",
                padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20,
            }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <p style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.2em", color: "#ba843c", fontWeight: 700, textTransform: "uppercase" }}>
                            Cambiar Mesa
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: "1rem", color: "#f5f1e8", fontWeight: 700 }}>
                            {reservation.guestName}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "rgba(245,241,232,0.45)" }}>
                            {reservation.guests} personas · {date} {time}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(245,241,232,0.5)", padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                        ✕ Cerrar
                    </button>
                </div>

                {/* Selector de área */}
                <div>
                    <p style={{ margin: "0 0 10px", fontSize: "0.65rem", letterSpacing: "0.15em", color: "rgba(245,241,232,0.4)", textTransform: "uppercase", fontWeight: 700 }}>
                        Área
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {MODAL_SECTIONS.map((sec) => (
                            <button
                                key={sec}
                                onClick={() => setSelectedSection(sec)}
                                style={{
                                    padding: "7px 16px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                                    background: selectedSection === sec ? "#ba843c" : "transparent",
                                    border: `1px solid ${selectedSection === sec ? "#ba843c" : "rgba(255,255,255,0.15)"}`,
                                    color: selectedSection === sec ? "#fff" : "rgba(245,241,232,0.6)",
                                    transition: "all 0.2s",
                                }}
                            >
                                {sec}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mapa de mesas */}
                <div>
                    {loading && (
                        <p style={{ textAlign: "center", color: "rgba(245,241,232,0.4)", fontSize: "0.85rem" }}>Cargando mesas…</p>
                    )}
                    {!loading && availability && !availability.isLargeGroup && (
                        <TableMap
                            data={availability}
                            guests={reservation.guests}
                            selection={selection}
                            onSelect={setSelection}
                        />
                    )}
                    {!loading && availability?.isLargeGroup && (
                        <p style={{ textAlign: "center", color: availability.hasAvailability ? "#ba843c" : "#e05555", fontSize: "0.85rem", margin: "12px 0" }}>
                            {availability.hasAvailability
                                ? `✓ Área ${selectedSection} disponible para grupo grande. Se asignará el área completa.`
                                : `✗ El área ${selectedSection} ya está bloqueada por otro grupo grande ese día.`}
                        </p>
                    )}
                    {!loading && availability && !availability.hasAvailability && !availability.isLargeGroup && (
                        <p style={{ textAlign: "center", color: "#e05555", fontSize: "0.82rem", margin: "12px 0 0" }}>
                            Sin mesas disponibles en {selectedSection} para este turno.
                        </p>
                    )}
                </div>

                {selLabel && (
                    <p style={{ textAlign: "center", color: "#ba843c", fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>
                        Seleccionada: {selLabel}
                    </p>
                )}

                {error && (
                    <p style={{ color: "#e05555", fontSize: "0.82rem", margin: 0 }}>⚠ {error}</p>
                )}

                {/* Acciones */}
                <div style={{ display: "flex", gap: 10 }}>
                    <button
                        onClick={onClose}
                        style={{ flex: 1, padding: "11px 0", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "rgba(245,241,232,0.5)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={(!selection && !isLargeGroupReady) || saving}
                        style={{
                            flex: 2, padding: "11px 0", background: (selection || isLargeGroupReady) ? "#ba843c" : "rgba(186,132,60,0.2)",
                            border: "none", borderRadius: 10, color: (selection || isLargeGroupReady) ? "#fff" : "rgba(245,241,232,0.3)",
                            fontWeight: 700, fontSize: "0.82rem", cursor: (selection || isLargeGroupReady) ? "pointer" : "default",
                            letterSpacing: "0.06em", textTransform: "uppercase",
                        }}
                    >
                        {saving ? "Guardando…" : "Confirmar Cambio"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Modal Editar Reserva ───────────────────────────────────────────────────
type EditData = {
    date: string; time: string; guests: number;
    guestName: string; guestPhone: string; sectionPreference?: string;
    tableId?: string; linkedTableId?: string; thirdTableId?: string;
    notes?: string; occasion?: string;
};

function EditReservationModal({
    reservation,
    onClose,
    onSave,
}: {
    reservation: Reservation;
    onClose: () => void;
    onSave: (data: EditData) => Promise<void>;
}) {
    const initDate = reservation.date.slice(0, 10);
    const initTime = new Date(reservation.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });

    const [guestName,   setGuestName]   = useState(reservation.guestName);
    const [guestPhone,  setGuestPhone]  = useState(reservation.guestPhone);
    const [date,        setDate]        = useState(initDate);
    const [time,        setTime]        = useState(initTime);

    const { timeSlots, isDayClosed } = (() => {
        if (!date) return { timeSlots: [] as string[], isDayClosed: false };
        const [y, mo, d] = date.split("-").map(Number);
        const dow = new Date(y, mo - 1, d).getDay();
        if (dow === 1) return { timeSlots: [] as string[], isDayClosed: true };
        const closeHour = dow === 0 ? 21 : (dow === 5 || dow === 6) ? 24 : 23;
        const slots: string[] = [];
        const pad = (n: number) => String(n).padStart(2, "0");
        for (let h = 8; h < closeHour; h++) { slots.push(`${pad(h)}:00`); slots.push(`${pad(h)}:30`); }
        if (closeHour < 24) slots.push(`${pad(closeHour)}:00`);
        return { timeSlots: slots, isDayClosed: false };
    })();
    const [guests,      setGuests]      = useState(reservation.guests);
    const [section,     setSection]     = useState<string>(reservation.sectionPreference ?? "Terraza");
    const [notes,       setNotes]       = useState(reservation.notes ?? "");
    const [occasion,    setOccasion]    = useState(reservation.occasion ?? "");

    const [availability, setAvailability] = useState<AvailabilityData | null>(null);
    const [selection,    setSelection]    = useState<TableSelection | null>(null);
    const [avLoading,    setAvLoading]    = useState(false);
    const [avError,      setAvError]      = useState<string | null>(null);
    const [saving,       setSaving]       = useState(false);
    const [error,        setError]        = useState<string | null>(null);

    const fetchAvailability = useCallback(async (sec: string, d: string, t: string, g: number) => {
        setAvLoading(true);
        setAvError(null);
        setSelection(null);
        setAvailability(null);
        try {
            const params = new URLSearchParams({ section: sec, date: d, time: t, guests: String(g) });
            const res  = await fetch(`/api/reservations/available-tables?${params}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setAvailability(data.data);
        } catch (e: unknown) {
            setAvError(e instanceof Error ? e.message : "Error al buscar mesas");
        } finally {
            setAvLoading(false);
        }
    }, []);

    useEffect(() => {
        if (date && time && guests > 0 && section) {
            fetchAvailability(section, date, time, guests);
        }
    }, [section, date, time, guests, fetchAvailability]);

    const selLabel = selection
        ? selection.thirdTableNumber
            ? `M${selection.tableNumber} + M${selection.linkedTableNumber} + M${selection.thirdTableNumber}`
            : selection.linkedTableNumber
            ? `M${selection.tableNumber} + M${selection.linkedTableNumber}`
            : `Mesa ${selection.tableNumber}`
        : null;

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            await onSave({
                date, time, guests, guestName, guestPhone,
                sectionPreference: section || undefined,
                tableId:           selection?.tableId,
                linkedTableId:     selection?.linkedTableId,
                thirdTableId:      selection?.thirdTableId,
                notes:             notes    || undefined,
                occasion:          occasion || undefined,
            });
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Error al guardar");
            setSaving(false);
        }
    };

    const inp: React.CSSProperties = {
        width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.05)", color: "#f5f1e8", fontSize: "0.85rem", boxSizing: "border-box",
    };
    const lbl: React.CSSProperties = {
        fontSize: "0.65rem", letterSpacing: "0.15em", color: "rgba(245,241,232,0.4)",
        textTransform: "uppercase", fontWeight: 700, marginBottom: 5, display: "block",
    };

    return (
        <div
            style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{ background: "#1a2628", border: "1px solid rgba(186,132,60,0.2)", borderRadius: 16, width: "100%", maxWidth: 700, maxHeight: "92vh", overflowY: "auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <p style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.2em", color: "#ba843c", fontWeight: 700, textTransform: "uppercase" }}>Editar Reserva</p>
                        <p style={{ margin: "4px 0 0", fontSize: "1rem", color: "#f5f1e8", fontWeight: 700 }}>{reservation.guestName}</p>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(245,241,232,0.5)", padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem" }}>✕</button>
                </div>

                {/* Datos del titular */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                        <label style={lbl}>Titular</label>
                        <input style={inp} value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                    </div>
                    <div>
                        <label style={lbl}>Celular</label>
                        <input style={inp} value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
                    </div>
                </div>

                {/* Fecha, hora, personas */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                        <label style={lbl}>Fecha</label>
                        <input type="date" style={{ ...inp, colorScheme: "dark" }} value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} />
                    </div>
                    <div>
                        <label style={lbl}>Hora</label>
                        {isDayClosed ? (
                            <p style={{ color: "#e05555", fontSize: "0.8rem", margin: "6px 0 0" }}>Lunes cerrado</p>
                        ) : (
                            <select style={{ ...inp, cursor: "pointer" }} value={time} onChange={(e) => setTime(e.target.value)} disabled={!date}>
                                <option value="" disabled>{date ? "Selecciona hora" : "Elige fecha primero"}</option>
                                {timeSlots.map((t) => (
                                    <option key={t} value={t} style={{ background: "#1b2224" }}>{t}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div>
                        <label style={lbl}>Personas</label>
                        <input type="number" min={1} max={50} style={inp} value={guests} onChange={(e) => setGuests(parseInt(e.target.value) || 1)} />
                    </div>
                </div>

                {/* Notas y ocasión */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                        <label style={lbl}>Ocasión</label>
                        <input style={inp} value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="Cumpleaños, aniversario…" />
                    </div>
                    <div>
                        <label style={lbl}>Notas</label>
                        <input style={inp} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Peticiones especiales…" />
                    </div>
                </div>

                {/* Selector de sección */}
                <div>
                    <p style={lbl}>Área</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {MODAL_SECTIONS.map((sec) => (
                            <button key={sec} onClick={() => setSection(sec)} style={{ padding: "7px 16px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", background: section === sec ? "#ba843c" : "transparent", border: `1px solid ${section === sec ? "#ba843c" : "rgba(255,255,255,0.15)"}`, color: section === sec ? "#fff" : "rgba(245,241,232,0.6)" }}>
                                {sec}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mapa de mesas */}
                <div>
                    <p style={{ ...lbl, marginBottom: 10 }}>Mesa {selLabel ? `· ${selLabel}` : "· (se auto-asignará si no eliges)"}</p>
                    {avLoading && <p style={{ textAlign: "center", color: "rgba(245,241,232,0.4)", fontSize: "0.85rem" }}>Cargando mesas…</p>}
                    {!avLoading && availability && !availability.isLargeGroup && (
                        <TableMap data={availability} guests={guests} selection={selection} onSelect={setSelection} />
                    )}
                    {!avLoading && availability?.isLargeGroup && (
                        <p style={{ textAlign: "center", color: availability.hasAvailability ? "#ba843c" : "#e05555", fontSize: "0.85rem" }}>
                            {availability.hasAvailability ? `✓ Área ${section} disponible para grupo grande.` : `✗ Área ${section} bloqueada ese día.`}
                        </p>
                    )}
                    {!avLoading && availability && !availability.hasAvailability && !availability.isLargeGroup && (
                        <p style={{ textAlign: "center", color: "#e05555", fontSize: "0.82rem" }}>Sin mesas disponibles en {section} para este turno.</p>
                    )}
                    {avError && <p style={{ color: "#e05555", fontSize: "0.82rem" }}>⚠ {avError}</p>}
                </div>

                {error && <p style={{ color: "#e05555", fontSize: "0.82rem", margin: 0 }}>⚠ {error}</p>}

                {/* Acciones */}
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: "11px 0", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "rgba(245,241,232,0.5)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "11px 0", background: "#ba843c", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: "0.82rem", cursor: saving ? "default" : "pointer", letterSpacing: "0.06em", textTransform: "uppercase", opacity: saving ? 0.6 : 1 }}>
                        {saving ? "Guardando…" : "Guardar Cambios"}
                    </button>
                </div>
            </div>
        </div>
    );
}
