"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TableMap } from "@/components/reservation/TableMap";
import type { AvailabilityData, TableSelection } from "@/components/reservation/types";
import { GoldSelect } from "@/components/ui/GoldSelect";
import type { SelectOption } from "@/components/ui/GoldSelect";
import { GuestsPicker } from "@/components/ui/GuestsPicker";
import { DatePicker } from "@/components/ui/DatePicker";

const OCCASION_OPTIONS: SelectOption[] = [
  { value: "",                  label: "— Sin celebración —"  },
  { value: "Cumpleaños",        label: "🎂  Cumpleaños"        },
  { value: "Aniversario",       label: "🥂  Aniversario"       },
  { value: "Cena de negocios",  label: "💼  Cena de negocios"  },
  { value: "Pedida de mano",    label: "💍  Pedida de mano"    },
  { value: "Otro",              label: "✨  Otro"              },
];

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
    requiresPayment?:  boolean;
    creditUsed?:       number;
    amountPaid?:       number | string | null;
    checkedInAt:       string | null;
    qrToken:           string;
    table:             { number: number; section: { name: string } } | null;
    user:              { name: string; email: string; phone: string };
}

// ── Status config ──────────────────────────────────────────────────────
const OCCASION_CONFIG: Record<string, { emoji: string; color: string; bg: string; border: string }> = {
    "Cumpleaños":        { emoji: "🎂", color: "#f472b6", bg: "rgba(244,114,182,0.10)", border: "rgba(244,114,182,0.45)" },
    "Aniversario":       { emoji: "🥂", color: "#c084fc", bg: "rgba(192,132,252,0.10)", border: "rgba(192,132,252,0.45)" },
    "Cena de negocios":  { emoji: "💼", color: "#60a5fa", bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.45)"  },
    "Pedida de mano":    { emoji: "💍", color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.45)"  },
    "Otro":              { emoji: "✨", color: "#ba843c", bg: "rgba(186,132,60,0.10)",  border: "rgba(186,132,60,0.45)"  },
};

function getOccasionConfig(occasion: string) {
    return OCCASION_CONFIG[occasion] ?? { emoji: "✨", color: "#ba843c", bg: "rgba(186,132,60,0.10)", border: "rgba(186,132,60,0.45)" };
}

const STATUS_LABEL: Record<string, string> = {
    PENDING_PAYMENT: "ESPERA PAGO",
    PENDING:     "PENDIENTE",
    CONFIRMED:   "CONFIRMADA",
    IN_PROGRESS: "EN CURSO",
    DELAYED:     "RETRASO",
    CANCELLED:   "CANCELADA",
    COMPLETED:   "COMPLETADA",
    NO_SHOW:     "NO SE PRESENTÓ",
};
const STATUS_COLOR: Record<string, string> = {
    PENDING_PAYMENT: "#d97706",
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
        // Convertir a fecha México antes de agrupar
        const key = new Date(r.date).toLocaleDateString("en-CA", { timeZone: MX_TZ });
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
    }

    const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: MX_TZ });

    return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, items]) => {
            const isToday = key === todayKey;
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
    const [moveTarget, setMoveTarget]       = useState<Reservation | null>(null);
    const [editTarget, setEditTarget]       = useState<Reservation | null>(null);
    const [showNewModal, setShowNewModal]   = useState(false);

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
        tableId?: string; linkedTableId?: string; thirdTableId?: string; fourthTableId?: string;
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

    const createReservation = async (data: {
        guestName: string; guestPhone: string; date: string; time: string;
        guests: number; sectionPreference?: string; notes?: string; occasion?: string;
        isLargeGroup?: boolean; tableId?: string; linkedTableId?: string; thirdTableId?: string; fourthTableId?: string;
    }) => {
        if (!userId) return;
        const res = await fetch("/api/admin/reservations", {
            method:  "POST",
            headers: { "Content-Type": "application/json", "x-user-id": userId },
            body:    JSON.stringify(data),
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
                tableId:           selection?.tableId       ?? null,
                linkedTableId:     selection?.linkedTableId ?? null,
                thirdTableId:      selection?.thirdTableId  ?? null,
                fourthTableId:     selection?.fourthTableId ?? null,
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
                    {userRole === "ADMIN" && (
                        <button
                            onClick={() => router.push("/admin/fechas-especiales")}
                            style={{ padding: "8px 14px", background: "rgba(186,132,60,0.12)", border: "1px solid rgba(186,132,60,0.35)", borderRadius: 8, color: "#ba843c", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em" }}
                        >
                            ✨ Fechas
                        </button>
                    )}
                    <button
                        onClick={() => setShowNewModal(true)}
                        style={{ padding: "8px 14px", background: "rgba(186,132,60,0.85)", border: "1px solid #ba843c", borderRadius: 8, color: "#fff", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em" }}
                    >
                        + Nueva Reserva
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

                                                        {r.occasion && (() => {
                                                            const oc = getOccasionConfig(r.occasion);
                                                            return (
                                                                <div style={{
                                                                    display: "flex", alignItems: "center", gap: 10,
                                                                    padding: "10px 14px",
                                                                    background: oc.bg,
                                                                    border: `1px solid ${oc.border}`,
                                                                    borderRadius: 10,
                                                                    marginTop: 4,
                                                                }}>
                                                                    <span style={{ fontSize: "1.35rem", lineHeight: 1, flexShrink: 0 }}>{oc.emoji}</span>
                                                                    <div>
                                                                        <p style={{ margin: 0, fontSize: "0.6rem", letterSpacing: "0.18em", textTransform: "uppercase", color: oc.color, fontWeight: 700, opacity: 0.75 }}>Celebración</p>
                                                                        <p style={{ margin: "1px 0 0", fontSize: "0.9rem", fontWeight: 800, color: oc.color, letterSpacing: "0.03em" }}>{r.occasion}</p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {r.requiresPayment && (
                                                            <div style={{
                                                                display: "flex", alignItems: "center", gap: 10,
                                                                padding: "8px 12px",
                                                                background: "rgba(186,132,60,0.10)",
                                                                border: "1px solid rgba(186,132,60,0.45)",
                                                                borderRadius: 10,
                                                                marginTop: 4,
                                                            }}>
                                                                <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>💳</span>
                                                                <div style={{ flex: 1 }}>
                                                                    <p style={{ margin: 0, fontSize: "0.58rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#ba843c", fontWeight: 700, opacity: 0.75 }}>
                                                                        Apartado fecha especial
                                                                    </p>
                                                                    <p style={{ margin: "1px 0 0", fontSize: "0.78rem", color: "#f5f1e8", fontWeight: 600 }}>
                                                                        {r.amountPaid && Number(r.amountPaid) > 0 && (
                                                                            <>Pagado: <b style={{ color: "#5fa15f" }}>${Number(r.amountPaid).toFixed(0)}</b></>
                                                                        )}
                                                                        {r.creditUsed && r.creditUsed > 0 && (
                                                                            <> · Crédito: <b style={{ color: "#ba843c" }}>${r.creditUsed.toFixed(0)}</b></>
                                                                        )}
                                                                        {r.status === "PENDING_PAYMENT" && (
                                                                            <span style={{ color: "#d97706" }}>Esperando confirmación de pago</span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}

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
            {/* ── Modal nueva reserva ── */}
            {showNewModal && (
                <NewReservationModal
                    onClose={() => setShowNewModal(false)}
                    onCreate={async (data) => {
                        await createReservation(data);
                        setShowNewModal(false);
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
    const date    = new Date(reservation.date).toLocaleDateString("en-CA", { timeZone: MX_TZ });
    const time    = new Date(reservation.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: MX_TZ });
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
        ? selection.fourthTableNumber
            ? `M${selection.tableNumber} + M${selection.linkedTableNumber} + M${selection.thirdTableNumber} + M${selection.fourthTableNumber}`
            : selection.thirdTableNumber
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
    tableId?: string; linkedTableId?: string; thirdTableId?: string; fourthTableId?: string;
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
    const initDate = new Date(reservation.date).toLocaleDateString("en-CA", { timeZone: MX_TZ });
    const initTime = new Date(reservation.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: MX_TZ });

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
        ? selection.fourthTableNumber
            ? `M${selection.tableNumber} + M${selection.linkedTableNumber} + M${selection.thirdTableNumber} + M${selection.fourthTableNumber}`
            : selection.thirdTableNumber
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
                tableId:            selection?.tableId,
                linkedTableId:      selection?.linkedTableId,
                thirdTableId:       selection?.thirdTableId,
                fourthTableId:      selection?.fourthTableId,
                notes:              notes    || undefined,
                occasion:           occasion || undefined,
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                        <label style={lbl}>Fecha</label>
                        <DatePicker value={date} onChange={(v) => { setDate(v); setTime(""); }} placeholder="Selecciona fecha" />
                    </div>
                    <div>
                        <label style={lbl}>Hora</label>
                        {isDayClosed ? (
                            <p style={{ color: "#e05555", fontSize: "0.8rem", margin: "6px 0 0" }}>Lunes cerrado</p>
                        ) : (
                            <GoldSelect
                                value={time}
                                onChange={setTime}
                                disabled={!date}
                                placeholder={date ? "Selecciona hora" : "Elige fecha primero"}
                                options={timeSlots.map((t): SelectOption => ({
                                    value: t,
                                    label: t,
                                    group: parseInt(t) < 14 ? "Brunch  ·  8:00 — 13:30" : "Cena  ·  14:00 — Cierre",
                                }))}
                            />
                        )}
                    </div>
                </div>
                <div>
                    <label style={lbl}>Personas</label>
                    {guests <= 15 ? (
                        <GuestsPicker
                            value={guests}
                            onChange={setGuests}
                            onLargeGroup={() => setGuests(16)}
                        />
                    ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                            <input type="number" min={16} max={500} style={{ ...inp, flex: 1 }} value={guests} onChange={(e) => setGuests(parseInt(e.target.value) || 16)} />
                            <button type="button" onClick={() => setGuests(2)} style={{ whiteSpace: "nowrap", padding: "0 12px", background: "transparent", border: "1px solid rgba(245,241,232,0.15)", borderRadius: 8, color: "rgba(245,241,232,0.4)", fontSize: "0.7rem", cursor: "pointer" }}>← Volver</button>
                        </div>
                    )}
                </div>

                {/* Notas y ocasión */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                        <label style={lbl}>¿Qué festejamos?</label>
                        <GoldSelect
                            value={occasion}
                            onChange={setOccasion}
                            options={OCCASION_OPTIONS}
                            placeholder="— Sin celebración —"
                        />
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

// ── Modal Nueva Reserva (hostess, sin restricciones) ───────────────────────
const NR_SECTIONS  = ["Terraza", "Planta Alta", "Salón", "Privado"] as const;

const NR_SLOTS     = (() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const s: string[] = [];
    for (let h = 8; h < 24; h++) { s.push(`${pad(h)}:00`); s.push(`${pad(h)}:30`); }
    return s;
})();

type NRStep = "form" | "map" | "large-confirm";

function NewReservationModal({
    onClose,
    onCreate,
}: {
    onClose: () => void;
    onCreate: (data: {
        guestName: string; guestPhone: string; date: string; time: string;
        guests: number; sectionPreference?: string; notes?: string; occasion?: string;
        isLargeGroup?: boolean; tableId?: string; linkedTableId?: string; thirdTableId?: string; fourthTableId?: string;
    }) => Promise<void>;
}) {
    const todayMx = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

    const [step,              setStep]              = useState<NRStep>("form");
    const [guestName,         setGuestName]         = useState("");
    const [guestPhone,        setGuestPhone]         = useState("");
    const [date,              setDate]               = useState(todayMx);
    const [time,              setTime]               = useState("13:00");
    const [guests,            setGuests]             = useState(2);
    const [largeGroupMode,    setLargeGroupMode]     = useState(false);
    const [customGuests,      setCustomGuests]       = useState("");
    const [section,           setSection]            = useState<string>("Terraza");
    const [occasion,          setOccasion]           = useState("");
    const [notes,             setNotes]              = useState("");
    const [availability,      setAvailability]       = useState<AvailabilityData | null>(null);
    const [selection,         setSelection]          = useState<TableSelection | null>(null);
    const [searching,         setSearching]          = useState(false);
    const [searchError,       setSearchError]        = useState<string | null>(null);
    const [saving,            setSaving]             = useState(false);
    const [saveError,         setSaveError]          = useState<string | null>(null);

    const fs: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#f5f1e8", fontSize: "0.85rem", boxSizing: "border-box" };
    const ls: React.CSSProperties = { display: "block", marginBottom: 6, fontSize: "0.65rem", letterSpacing: "0.15em", color: "rgba(245,241,232,0.4)", textTransform: "uppercase", fontWeight: 700 };

    const readableDate = date ? new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: MX_TZ }) : "";

    const handleSearch = async () => {
        setSearchError(null);
        if (!guestName.trim() || !guestPhone.trim() || !date || !time) {
            setSearchError("Completa nombre, celular, fecha y hora.");
            return;
        }
        setSearching(true);
        try {
            const params = new URLSearchParams({ section, date, time, guests: String(guests) });
            const res  = await fetch(`/api/reservations/available-tables?${params}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            if (guests > 15) {
                if (!data.data.hasAvailability) {
                    setSearchError(`El área ${section} ya tiene una reserva de grupo grande ese día.`);
                    return;
                }
                setStep("large-confirm");
            } else {
                setAvailability(data.data);
                setSelection(null);
                setStep("map");
            }
        } catch (e: unknown) {
            setSearchError(e instanceof Error ? e.message : "Error al buscar disponibilidad");
        } finally {
            setSearching(false);
        }
    };

    const doCreate = async (extra: { isLargeGroup?: boolean; tableId?: string; linkedTableId?: string; thirdTableId?: string; fourthTableId?: string }) => {
        setSaveError(null);
        setSaving(true);
        try {
            await onCreate({
                guestName: guestName.trim(), guestPhone: guestPhone.trim(),
                date, time, guests,
                sectionPreference: section || undefined,
                occasion: occasion || undefined,
                notes:    notes.trim() || undefined,
                ...extra,
            });
        } catch (e: unknown) {
            setSaveError(e instanceof Error ? e.message : "Error al crear reserva");
            setSaving(false);
        }
    };

    const selLabel = selection
        ? selection.fourthTableNumber
            ? `M${selection.tableNumber} + M${selection.linkedTableNumber} + M${selection.thirdTableNumber} + M${selection.fourthTableNumber}`
            : selection.thirdTableNumber
            ? `M${selection.tableNumber} + M${selection.linkedTableNumber} + M${selection.thirdTableNumber}`
            : selection.linkedTableNumber
            ? `M${selection.tableNumber} + M${selection.linkedTableNumber}`
            : `Mesa M${selection.tableNumber}`
        : null;

    const btnBack  = { background: "none", border: "1px solid rgba(186,132,60,0.4)", borderRadius: 8, color: "rgba(245,241,232,0.7)", padding: "6px 14px", cursor: "pointer", fontSize: "0.75rem" } as const;
    const btnCancel = { flex: 1, padding: "11px 0", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "rgba(245,241,232,0.5)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" } as const;
    const btnPrimary = (disabled?: boolean) => ({ flex: 2, padding: "11px 0", background: disabled ? "rgba(186,132,60,0.2)" : "#ba843c", border: "none", borderRadius: 10, color: disabled ? "rgba(245,241,232,0.3)" : "#fff", fontWeight: 700, fontSize: "0.82rem", cursor: disabled ? "default" : "pointer", letterSpacing: "0.06em", textTransform: "uppercase" as const });

    return (
        <div
            style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{ background: "#1a2628", border: "1px solid rgba(186,132,60,0.25)", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {step !== "form" && (
                            <button style={btnBack} onClick={() => { setStep("form"); setAvailability(null); setSelection(null); }}>← Volver</button>
                        )}
                        <div>
                            <p style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.2em", color: "#ba843c", fontWeight: 700, textTransform: "uppercase" }}>Nueva Reserva</p>
                            <p style={{ margin: "3px 0 0", fontSize: "0.95rem", color: "#f5f1e8", fontWeight: 700 }}>
                                {step === "form" ? "Datos de la reserva" : step === "map" ? "Seleccionar mesa" : "Confirmar grupo grande"}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(245,241,232,0.5)", padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem" }}>✕</button>
                </div>

                {/* ── PASO 1: FORMULARIO ── */}
                {step === "form" && (<>
                    {/* Nombre + Celular */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <label>
                            <span style={ls}>Nombre *</span>
                            <input style={fs} value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Titular" />
                        </label>
                        <label>
                            <span style={ls}>Celular *</span>
                            <input style={fs} type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="10 dígitos" />
                        </label>
                    </div>

                    {/* Fecha + Hora */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                            <span style={ls}>Fecha *</span>
                            <DatePicker value={date} onChange={setDate} placeholder="Selecciona fecha" />
                        </div>
                        <div>
                            <span style={ls}>Hora *</span>
                            <GoldSelect
                                value={time}
                                onChange={setTime}
                                placeholder="Selecciona hora"
                                options={NR_SLOTS.map((s): SelectOption => ({
                                    value: s,
                                    label: s,
                                    group: parseInt(s) < 14 ? "Brunch  ·  8:00 — 13:30" : "Cena  ·  14:00 — Cierre",
                                }))}
                            />
                        </div>
                    </div>

                    {/* Personas */}
                    <div>
                        <span style={ls}>Personas *</span>
                        {!largeGroupMode ? (
                            <GuestsPicker
                                value={guests}
                                onChange={setGuests}
                                onLargeGroup={() => { setLargeGroupMode(true); setCustomGuests(""); setGuests(16); }}
                            />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <input style={{ ...fs, flex: 1 }} type="number" min={16} placeholder="Ej. 20" value={customGuests}
                                        onChange={(e) => { setCustomGuests(e.target.value); const n = parseInt(e.target.value); if (!isNaN(n) && n >= 16) setGuests(n); }} />
                                    <button type="button" onClick={() => { setLargeGroupMode(false); setCustomGuests(""); setGuests(2); }}
                                        style={{ whiteSpace: "nowrap", padding: "0 12px", background: "transparent", border: "1px solid rgba(245,241,232,0.15)", borderRadius: 8, color: "rgba(245,241,232,0.4)", fontSize: "0.7rem", cursor: "pointer" }}>
                                        Cancelar
                                    </button>
                                </div>
                                <p style={{ margin: 0, fontSize: "0.68rem", color: "rgba(186,132,60,0.75)", lineHeight: 1.4 }}>Grupos de +15 personas reservan el área completa por todo el día.</p>
                            </div>
                        )}
                    </div>

                    {/* Sección */}
                    <div>
                        <span style={ls}>Área</span>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {NR_SECTIONS.map((s) => (
                                <button key={s} onClick={() => setSection(s)}
                                    style={{ padding: "7px 16px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                                        background: section === s ? "#ba843c" : "transparent",
                                        border: `1px solid ${section === s ? "#ba843c" : "rgba(255,255,255,0.15)"}`,
                                        color: section === s ? "#fff" : "rgba(245,241,232,0.6)" }}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Ocasión */}
                    <div>
                        <span style={ls}>¿Qué festejamos?</span>
                        <GoldSelect
                            value={occasion}
                            onChange={setOccasion}
                            options={OCCASION_OPTIONS}
                            placeholder="— Sin celebración —"
                        />
                    </div>

                    {/* Notas */}
                    <label>
                        <span style={ls}>Solicitud especial</span>
                        <textarea style={{ ...fs, resize: "vertical", minHeight: 68 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alergias, decoración, peticiones especiales…" />
                    </label>

                    {searchError && <p style={{ margin: 0, color: "#e05555", fontSize: "0.82rem" }}>⚠ {searchError}</p>}

                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={onClose} style={btnCancel}>Cancelar</button>
                        <button onClick={handleSearch} disabled={searching} style={btnPrimary(searching)}>
                            {searching ? "Verificando…" : "Buscar Disponibilidad"}
                        </button>
                    </div>
                </>)}

                {/* ── PASO 2: MAPA DE MESAS ── */}
                {step === "map" && availability && (<>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(245,241,232,0.45)" }}>
                        {section} · {guests} {guests === 1 ? "persona" : "personas"} · {date} {time}
                    </p>
                    <TableMap data={availability} guests={guests} selection={selection} onSelect={setSelection} />
                    {selLabel && <p style={{ margin: 0, textAlign: "center", color: "#ba843c", fontSize: "0.85rem", fontWeight: 600 }}>{selLabel}</p>}
                    {!availability.hasAvailability && <p style={{ margin: 0, color: "#e05555", fontSize: "0.82rem", textAlign: "center" }}>Sin mesas disponibles en {section} para ese horario.</p>}
                    {saveError && <p style={{ margin: 0, color: "#e05555", fontSize: "0.82rem" }}>⚠ {saveError}</p>}
                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={onClose} style={btnCancel}>Cancelar</button>
                        <button disabled={!selection || saving} onClick={() => doCreate({ tableId: selection?.tableId, linkedTableId: selection?.linkedTableId, thirdTableId: selection?.thirdTableId, fourthTableId: selection?.fourthTableId })} style={btnPrimary(!selection || saving)}>
                            {saving ? "Creando…" : "Confirmar Reserva"}
                        </button>
                    </div>
                </>)}

                {/* ── PASO 3: GRUPO GRANDE ── */}
                {step === "large-confirm" && (<>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(245,241,232,0.45)" }}>{section} · {guests} personas · {date} {time}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {([["Titular", guestName], ["Teléfono", guestPhone], ["Fecha", readableDate], ["Hora", time], ["Personas", `${guests} personas`], ["Área", section], ...(notes ? [["Notas", notes]] : [])] as [string,string][]).map(([l, v]) => (
                            <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                <span style={{ fontSize: "0.72rem", color: "rgba(245,241,232,0.4)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{l}</span>
                                <span style={{ fontSize: "0.82rem", color: "rgba(245,241,232,0.85)", textAlign: "right" }}>{v}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ background: "rgba(186,132,60,0.07)", border: "1px solid rgba(186,132,60,0.25)", borderRadius: 10, padding: "14px 16px" }}>
                        <p style={{ margin: "0 0 6px", fontSize: "0.75rem", fontWeight: 700, color: "#ba843c", letterSpacing: "0.04em" }}>RESERVA EXCLUSIVA DE ÁREA</p>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(245,241,232,0.65)", lineHeight: 1.6 }}>
                            El área completa de <strong style={{ color: "rgba(245,241,232,0.85)" }}>{section}</strong> quedará bloqueada para el grupo durante todo el <strong style={{ color: "rgba(245,241,232,0.85)" }}>{readableDate}</strong>.
                        </p>
                    </div>
                    {saveError && <p style={{ margin: 0, color: "#e05555", fontSize: "0.82rem" }}>⚠ {saveError}</p>}
                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={onClose} style={btnCancel}>Cancelar</button>
                        <button disabled={saving} onClick={() => doCreate({ isLargeGroup: true })} style={btnPrimary(saving)}>
                            {saving ? "Creando…" : `Confirmar — ${guests} Personas`}
                        </button>
                    </div>
                </>)}
            </div>
        </div>
    );
}
