"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { TableSelection, Reservation } from "@/components/reservation/types";
import { MX_TZ } from "@/components/reservation/types";
import { useSession } from "@/lib/session-client";
import { MoveTableModal } from "@/components/reservation/MoveTableModal";
import { EditReservationModal } from "@/components/reservation/EditReservationModal";
import { NewReservationModal } from "@/components/reservation/NewReservationModal";

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
// Colores de estado usados como TEXTO/borde sobre fondo oscuro → tonos con
// contraste AA (≥4.5:1). Los archivados van atenuados pero aún legibles.
const STATUS_COLOR: Record<string, string> = {
    PENDING_PAYMENT: "#e09632",
    PENDING:     "#c9964a",
    CONFIRMED:   "#63aede",
    IN_PROGRESS: "#5cbf60",
    DELAYED:     "#e8766b",
    CANCELLED:   "rgba(255,255,255,0.6)",
    COMPLETED:   "rgba(255,255,255,0.55)",
    NO_SHOW:     "#d95f4a",
};

const STATUS_GROUPS: { key: string; label: string; color: string }[] = [
    { key: "IN_PROGRESS", label: "EN CURSO",            color: "#5cbf60" },
    { key: "DELAYED",     label: "RETRASO",              color: "#e8766b" },
    { key: "PENDING",     label: "PENDIENTES",           color: "#c9964a" },
    { key: "CONFIRMED",   label: "CONFIRMADAS",          color: "#63aede" },
    { key: "COMPLETED",   label: "COMPLETADAS",          color: "rgba(255,255,255,0.55)" },
    { key: "NO_SHOW",     label: "NO SE PRESENTARON",    color: "#d95f4a" },
    { key: "CANCELLED",   label: "CANCELADAS",           color: "rgba(255,255,255,0.5)" },
];

const DELETABLE_STATUSES  = ["CANCELLED", "NO_SHOW", "COMPLETED"];
const ARCHIVED_STATUSES   = ["CANCELLED", "NO_SHOW", "COMPLETED"]; // se mueven a /admin/historial

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
    const session = useSession();
    const userId   = session.user?.id   ?? null;
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading]           = useState(true);
    const [section, setSection]           = useState("Todas");
    const [date, setDate]                 = useState("");
    const [search, setSearch]             = useState("");
    const [updating, setUpdating]         = useState<string | null>(null);
    const [onlyPending, setOnlyPending]   = useState(false);
    const [moveTarget, setMoveTarget]       = useState<Reservation | null>(null);
    const [editTarget, setEditTarget]       = useState<Reservation | null>(null);
    const [noteTarget, setNoteTarget]       = useState<Reservation | null>(null);
    const [showNewModal, setShowNewModal]   = useState(false);

    useEffect(() => {
        if (session.loading) return;
        if (!session.user || !["ADMIN", "HOSTES"].includes(session.user.role)) {
            router.push("/login?mode=login");
        }
    }, [router, session.loading, session.user]);

    const fetchReservations = useCallback(async (silent = false) => {
        if (!userId) return;
        if (!silent) setLoading(true);
        const params = new URLSearchParams();
        if (section !== "Todas") params.set("section", section);
        if (date)   params.set("date",   date);
        if (search) params.set("search", search);
        const res  = await fetch(`/api/admin/reservations?${params}`, { credentials: "same-origin" });
        const data = await res.json();
        if (data.success) setReservations(data.data);
        if (!silent) setLoading(false);
    }, [userId, section, date, search]);

    useEffect(() => { fetchReservations(); }, [fetchReservations]);

    // Poll silencioso: reservas nuevas (bot/web) aparecen solas, sin spinner.
    useEffect(() => {
        const iv = setInterval(() => fetchReservations(true), 20000);
        return () => clearInterval(iv);
    }, [fetchReservations]);

    // ── "Nueva reserva" no vista aún: puntito parpadeante ──────────────
    // Se apaga al hacer clic en la tarjeta o tras 10 min visible en panel.
    const markSeen = useCallback((id: string) => {
        setReservations((prev) =>
            prev.map((r) => (r.id === id && !r.seenAt ? { ...r, seenAt: new Date().toISOString() } : r)),
        );
        fetch(`/api/admin/reservations/${id}/seen`, { method: "POST", credentials: "same-origin" })
            .catch(() => { /* el poll reconciliará */ });
    }, []);

    // Registra el primer momento visible de cada reserva no vista.
    const seenShownAtRef = useRef<Map<string, number>>(new Map());
    useEffect(() => {
        const now = Date.now();
        for (const r of reservations) {
            if (!r.seenAt && !seenShownAtRef.current.has(r.id)) {
                seenShownAtRef.current.set(r.id, now);
            }
        }
    }, [reservations]);

    // Auto-marca vista tras 10 min visible en el panel.
    useEffect(() => {
        const iv = setInterval(() => {
            const t = Date.now();
            for (const [id, shownAt] of Array.from(seenShownAtRef.current.entries())) {
                if (t - shownAt >= 10 * 60 * 1000) {
                    markSeen(id);
                    seenShownAtRef.current.delete(id);
                }
            }
        }, 30000);
        return () => clearInterval(iv);
    }, [markSeen]);

    const updateStatus = async (id: string, status: string) => {
        if (!userId) return;
        setUpdating(id);
        await fetch(`/api/admin/reservations/${id}`, {
            method:  "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ status }),
        });
        await fetchReservations();
        setUpdating(null);
    };

    // Eliminar reservas se hace ahora desde /admin/historial

    const editReservation = async (id: string, data: {
        date: string; time: string; guests: number;
        guestName: string; guestPhone: string; sectionPreference?: string;
        tableId?: string; linkedTableId?: string; thirdTableId?: string; fourthTableId?: string;
        notes?: string; occasion?: string;
    }) => {
        if (!userId) return;
        const res = await fetch(`/api/admin/reservations/${id}`, {
            method:  "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
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
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(data),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        await fetchReservations();
    };

    const moveTable = async (id: string, selection: TableSelection | null, sectionPreference: string, forceAssign = false) => {
        if (!userId) return;
        const res = await fetch(`/api/admin/reservations/${id}`, {
            method:  "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action:            "move-table",
                tableId:           selection?.tableId       ?? null,
                linkedTableId:     selection?.linkedTableId ?? null,
                thirdTableId:      selection?.thirdTableId  ?? null,
                fourthTableId:     selection?.fourthTableId ?? null,
                sectionPreference,
                forceAssign,
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
        !ARCHIVED_STATUSES.includes(r.status) && (!onlyPending || r.status === "PENDING")
    );
    const groups = groupByDate(displayed);

    return (
        <div className="adm-page">
            <style>{`
                @keyframes admNewPulse {
                    0%, 100% { opacity: 1;   transform: scale(1);    }
                    50%      { opacity: 0.3; transform: scale(0.75); }
                }
                .adm-new-badge {
                    display: inline-flex; align-items: center; gap: 6px;
                    align-self: flex-start;
                    padding: 3px 10px; margin-bottom: 6px;
                    border-radius: 999px;
                    background: rgba(224,85,85,0.14);
                    border: 1px solid rgba(224,85,85,0.55);
                    color: #e8766b;
                    font-size: 0.6rem; font-weight: 800;
                    letter-spacing: 0.16em; text-transform: uppercase;
                }
                .adm-new-dot {
                    width: 8px; height: 8px; border-radius: 50%;
                    background: #e8766b;
                    animation: admNewPulse 1.1s ease-in-out infinite;
                }
                .adm-hold-badge {
                    display: inline-flex; align-items: center;
                    align-self: flex-start;
                    padding: 3px 10px; margin-bottom: 6px;
                    border-radius: 999px;
                    background: rgba(224,150,50,0.14);
                    border: 1px solid rgba(224,150,50,0.6);
                    color: #e0a13f;
                    font-size: 0.62rem; font-weight: 800;
                    letter-spacing: 0.12em; text-transform: uppercase;
                }
                @media (prefers-reduced-motion: reduce) {
                    .adm-new-dot { animation: none; }
                }
            `}</style>
            {/* ── CTA: nueva reserva (la navegación global la provee el sidebar) ── */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 8 }}>
                <button
                    onClick={() => setShowNewModal(true)}
                    style={{ padding: "9px 16px", background: "rgba(186,132,60,0.85)", border: "1px solid #ba843c", borderRadius: 8, color: "#fff", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em", fontFamily: "inherit" }}
                >
                    + Nueva reserva
                </button>
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
                    <button className="adm-search-btn" onClick={() => fetchReservations()}>Buscar</button>
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
                                                    <div key={r.id} className="adm-card" onClick={() => { if (!r.seenAt) markSeen(r.id); }}>
                                                        {!r.seenAt && (
                                                            <div className="adm-new-badge">
                                                                <span className="adm-new-dot" />
                                                                Nueva
                                                            </div>
                                                        )}
                                                        {r.tablesProvisional && !ARCHIVED_STATUSES.includes(r.status) && (
                                                            <div className="adm-hold-badge">⚠ Revisar mesas</div>
                                                        )}
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
                                                            <div className="adm-row">
                                                                <span className="adm-row-label">NOTAS:</span>
                                                                {r.notes ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setNoteTarget(r)}
                                                                        style={{
                                                                            background: "transparent",
                                                                            border: "1px solid rgba(186,132,60,0.5)",
                                                                            color: "#ba843c",
                                                                            padding: "2px 10px",
                                                                            borderRadius: 999,
                                                                            fontSize: "0.7rem",
                                                                            fontWeight: 600,
                                                                            letterSpacing: "0.04em",
                                                                            cursor: "pointer",
                                                                            fontFamily: "inherit",
                                                                        }}
                                                                    >
                                                                        Ver más…
                                                                    </button>
                                                                ) : (
                                                                    <span className="adm-row-val" style={{ color: "rgba(245,241,232,0.6)" }}>—</span>
                                                                )}
                                                            </div>
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
                                                            {/* Eliminar movido a /admin/historial para evitar borrados accidentales */}
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
                    onMove={async (selection, sectionPref, forceAssign) => {
                        await moveTable(moveTarget.id, selection, sectionPref, forceAssign);
                        setMoveTarget(null);
                    }}
                />
            )}
            {/* ── Isla de nota ── */}
            {noteTarget && (
                <NoteIsland
                    guestName={noteTarget.guestName}
                    note={noteTarget.notes ?? ""}
                    onClose={() => setNoteTarget(null)}
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

// ── Isla flotante para mostrar la nota completa ─────────────────────────
function NoteIsland({ guestName, note, onClose }: { guestName: string; note: string; onClose: () => void }) {
    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(4px)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: "var(--sl-panel2)",
                    border: "1px solid rgba(186,132,60,0.4)",
                    borderRadius: 16,
                    padding: "28px 30px 26px",
                    maxWidth: 480,
                    width: "100%",
                    maxHeight: "70vh",
                    overflowY: "auto",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
                    color: "#f5f1e8",
                    fontFamily: "inherit",
                    position: "relative",
                }}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cerrar"
                    style={{
                        position: "absolute",
                        top: 10,
                        right: 12,
                        background: "transparent",
                        border: "none",
                        color: "rgba(245,241,232,0.5)",
                        fontSize: "1.4rem",
                        cursor: "pointer",
                        lineHeight: 1,
                        padding: 4,
                        fontFamily: "inherit",
                    }}
                >
                    ✕
                </button>
                <div style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#ba843c", fontWeight: 700, marginBottom: 6 }}>
                    Nota de reserva
                </div>
                <div style={{ fontSize: "0.85rem", color: "rgba(245,241,232,0.6)", marginBottom: 16 }}>
                    {guestName}
                </div>
                <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {note}
                </p>
            </div>
        </div>
    );
}
