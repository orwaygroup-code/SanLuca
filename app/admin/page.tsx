"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

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
    NO_SHOW:     "#e05555",
};

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
    }).toUpperCase();
}
function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_PRIORITY: Record<string, number> = {
    IN_PROGRESS: 0,
    DELAYED:     1,
    PENDING:     2,
    CONFIRMED:   3,
    COMPLETED:   4,
    NO_SHOW:     5,
    CANCELLED:   6,
};

function groupByDate(reservations: Reservation[]): { label: string; isToday: boolean; items: Reservation[] }[] {
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
            const sorted = [...items].sort(
                (a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9)
                       || a.date.localeCompare(b.date)
            );
            return { label, isToday, items: sorted };
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

    const sectionIdx = SECTIONS.indexOf(section);
    const thumbLeft  = `calc(${(sectionIdx / SECTIONS.length) * 100}% + 4px)`;
    const thumbWidth = `calc(${100 / SECTIONS.length}% - 8px)`;

    if (!userId) return null;

    const groups = groupByDate(reservations);

    return (
        <div className="adm-page">
            {/* ── Header ── */}
            <div className="adm-header">
                <h1 className="adm-title">
                    <span className="adm-title--gold">RESERVACIONES</span>
                    {" "}<span className="adm-title--white">{userRole === "ADMIN" ? "ADMIN" : "HOSTESS"}</span>
                </h1>
                <button className="adm-logout" onClick={() => { localStorage.clear(); router.push("/login?mode=login"); }}>
                    Salir
                </button>
            </div>

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
                    {groups.map(({ label, isToday, items }) => (
                        <div key={label}>
                            {/* Separador de fecha */}
                            <div className="adm-date-separator">
                                <span className={`adm-date-separator__label${isToday ? " adm-date-separator__label--today" : ""}`}>
                                    {label}
                                </span>
                            </div>

                            <div className="adm-grid">
                                {items.map((r) => (
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
                                            {userRole === "HOSTES" && (NEXT_STATUSES[r.status] ?? []).map((action) => (
                                                <button
                                                    key={action.value}
                                                    className="adm-btn-gold"
                                                    disabled={updating === r.id}
                                                    onClick={() => updateStatus(r.id, action.value)}
                                                >
                                                    {updating === r.id ? "…" : action.label.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
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
