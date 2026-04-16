"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────
type TableStatus = "available" | "reserved" | "in_progress" | "walk_in" | "area_blocked";

interface LargeGroupInfo {
    id: string; status: string; guestName: string; guests: number; time: string;
}

interface LiveTable {
    id:       string;
    number:   number;
    capacity: number;
    status:   TableStatus;
    reservation: { id: string; status: string; guestName: string; guests: number; time: string } | null;
    block:       { note: string | null; createdAt: string } | null;
}

interface LiveSection {
    id:         string;
    name:       string;
    largeGroup: LargeGroupInfo | null;
    tables:     LiveTable[];
}

// ── Styling maps ──────────────────────────────────────────────────────────────
const STATUS_BG: Record<TableStatus, string> = {
    available:    "#1e2c2e",
    reserved:     "#1a2d3d",
    in_progress:  "#3a1010",
    walk_in:      "#2e1e08",
    area_blocked: "#2a0d2a",
};
const STATUS_BORDER: Record<TableStatus, string> = {
    available:    "rgba(255,255,255,0.08)",
    reserved:     "rgba(74,158,202,0.55)",
    in_progress:  "rgba(224,85,85,0.8)",
    walk_in:      "rgba(186,132,60,0.75)",
    area_blocked: "rgba(180,60,180,0.75)",
};
const STATUS_DOT: Record<TableStatus, string> = {
    available:    "#4caf50",
    reserved:     "#4a9eca",
    in_progress:  "#e05555",
    walk_in:      "#ba843c",
    area_blocked: "#b43cb4",
};
const STATUS_LABEL: Record<TableStatus, string> = {
    available:    "Libre",
    reserved:     "Reservada",
    in_progress:  "En curso",
    walk_in:      "Walk-in",
    area_blocked: "Área bloqueada",
};

const LG_STATUS_LABEL: Record<string, string> = {
    PENDING:     "Pendiente",
    CONFIRMED:   "Confirmada",
    IN_PROGRESS: "En curso",
    DELAYED:     "Con retraso",
};

// ── Main component ────────────────────────────────────────────────────────────
export default function MapaPage() {
    const router = useRouter();
    const [userId,     setUserId]     = useState<string | null>(null);
    const [data,       setData]       = useState<LiveSection[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [selected,        setSelected]        = useState<LiveTable | null>(null);
    const [sectionTarget,   setSectionTarget]   = useState<LiveSection | null>(null);
    const [blocking,        setBlocking]        = useState(false);
    const [note,            setNote]            = useState("");
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const uid  = localStorage.getItem("userId");
        const role = localStorage.getItem("userRole");
        if (!uid || !["ADMIN", "HOSTES"].includes(role ?? "")) { router.push("/login?mode=login"); return; }
        setUserId(uid);
    }, [router]);

    const fetchMap = useCallback(async (uid: string) => {
        try {
            const res  = await fetch("/api/admin/map", { headers: { "x-user-id": uid } });
            const json = await res.json();
            if (json.success) { setData(json.data); setLastUpdate(new Date()); }
        } catch { /* silent */ } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!userId) return;
        fetchMap(userId);
        intervalRef.current = setInterval(() => fetchMap(userId), 20_000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [userId, fetchMap]);

    const toggleBlock = async (table: LiveTable) => {
        if (!userId) return;
        const isBlocked = table.status === "walk_in";
        setBlocking(true);
        await fetch("/api/admin/map", {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": userId },
            body:    JSON.stringify({ tableId: table.id, action: isBlocked ? "unblock" : "block", note: note || undefined }),
        });
        setSelected(null);
        setNote("");
        setBlocking(false);
        fetchMap(userId);
    };

    const toggleSectionBlock = async (sec: LiveSection, block: boolean) => {
        if (!userId) return;
        setBlocking(true);
        await fetch("/api/admin/map", {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": userId },
            body:    JSON.stringify({ sectionId: sec.id, action: block ? "block-section" : "unblock-section", note: note || undefined }),
        });
        setSectionTarget(null);
        setNote("");
        setBlocking(false);
        fetchMap(userId);
    };

    if (!userId) return null;

    const allTables = data.flatMap((s) => s.tables);
    const counts: Record<TableStatus, number> = {
        available:    allTables.filter((t) => t.status === "available").length,
        reserved:     allTables.filter((t) => t.status === "reserved").length,
        in_progress:  allTables.filter((t) => t.status === "in_progress").length,
        walk_in:      allTables.filter((t) => t.status === "walk_in").length,
        area_blocked: allTables.filter((t) => t.status === "area_blocked").length,
    };

    const pill = (s: React.CSSProperties): React.CSSProperties => ({
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 14px", borderRadius: 10, ...s,
    });

    return (
        <div style={{ minHeight: "100vh", background: "#0f1a1c", color: "#f5f1e8", fontFamily: "var(--font-cormorant, serif)", padding: "24px 16px", maxWidth: 900, margin: "0 auto" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                <div>
                    <p style={{ margin: 0, fontSize: "0.6rem", letterSpacing: "0.28em", color: "#ba843c", fontWeight: 700, textTransform: "uppercase" }}>San Luca · Hostess</p>
                    <h1 style={{ margin: "4px 0 0", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Mapa en Vivo</h1>
                    {lastUpdate && (
                        <p style={{ margin: "4px 0 0", fontSize: "0.68rem", color: "rgba(245,241,232,0.3)" }}>
                            {lastUpdate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · refresca cada 20s
                        </p>
                    )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => userId && fetchMap(userId)} style={{ padding: "8px 14px", background: "rgba(186,132,60,0.12)", border: "1px solid rgba(186,132,60,0.35)", borderRadius: 8, color: "#ba843c", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
                        ↺ Refrescar
                    </button>
                    <button onClick={() => router.push("/admin")} style={{ padding: "8px 14px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(245,241,232,0.45)", fontSize: "0.75rem", cursor: "pointer" }}>
                        ← Reservas
                    </button>
                </div>
            </div>

            {/* Resumen */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
                {(Object.keys(counts) as TableStatus[]).filter((s) => s !== "area_blocked" || counts[s] > 0).map((s) => (
                    <div key={s} style={pill({ background: STATUS_BG[s], border: `1px solid ${STATUS_BORDER[s]}` })}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_DOT[s], flexShrink: 0 }} />
                        <span style={{ fontSize: "0.82rem", fontWeight: 700 }}>{counts[s]}</span>
                        <span style={{ fontSize: "0.7rem", color: "rgba(245,241,232,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{STATUS_LABEL[s]}</span>
                    </div>
                ))}
            </div>

            {/* Secciones */}
            {loading ? (
                <p style={{ textAlign: "center", color: "rgba(245,241,232,0.3)", marginTop: 60 }}>Cargando mesas…</p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                    {data.map((sec) => (
                        <div key={sec.id}>
                            {/* Header de sección */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                                <p style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.2em", color: sec.largeGroup ? "#b43cb4" : "#ba843c", fontWeight: 700, textTransform: "uppercase" }}>
                                    {sec.name}
                                </p>
                                {sec.largeGroup && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 12px", background: "rgba(180,60,180,0.12)", border: "1px solid rgba(180,60,180,0.4)", borderRadius: 20 }}>
                                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#b43cb4", flexShrink: 0 }} />
                                        <span style={{ fontSize: "0.68rem", color: "#d080d0", fontWeight: 700 }}>
                                            BLOQUEO DE ÁREA · {sec.largeGroup.guestName} · {sec.largeGroup.guests} personas · {sec.largeGroup.time} · {LG_STATUS_LABEL[sec.largeGroup.status] ?? sec.largeGroup.status}
                                        </span>
                                    </div>
                                )}
                                {/* Botón bloquear / liberar área completa */}
                                {!sec.largeGroup && (() => {
                                    const allBlocked = sec.tables.length > 0 && sec.tables.every((t) => t.status === "walk_in");
                                    return (
                                        <button
                                            onClick={() => { setNote(""); setSectionTarget(sec); }}
                                            style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 20, fontSize: "0.67rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", border: allBlocked ? "1px solid rgba(76,175,80,0.6)" : "1px solid rgba(180,60,180,0.5)", background: allBlocked ? "rgba(76,175,80,0.1)" : "rgba(180,60,180,0.1)", color: allBlocked ? "#4caf50" : "#d080d0" }}
                                        >
                                            {allBlocked ? "🔓 Liberar área" : "🚫 Bloquear área"}
                                        </button>
                                    );
                                })()}
                            </div>

                            {/* Banner de área bloqueada */}
                            {sec.largeGroup && (
                                <div style={{ marginBottom: 12, padding: "12px 16px", background: "rgba(180,60,180,0.08)", border: "1px solid rgba(180,60,180,0.3)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
                                    <span style={{ fontSize: "1.2rem" }}>🚫</span>
                                    <div>
                                        <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 700, color: "#d080d0" }}>
                                            Área completa reservada para grupo grande
                                        </p>
                                        <p style={{ margin: "2px 0 0", fontSize: "0.7rem", color: "rgba(245,241,232,0.45)" }}>
                                            {sec.largeGroup.guestName} · {sec.largeGroup.guests} personas · {sec.largeGroup.time} · Estado: {LG_STATUS_LABEL[sec.largeGroup.status] ?? sec.largeGroup.status}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Mesas */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                {sec.tables.map((t) => (
                                    <TableCard key={t.id} table={t} onClick={() => {
                                        if (t.status === "in_progress" || t.status === "reserved" || t.status === "area_blocked") return;
                                        setNote("");
                                        setSelected(t);
                                    }} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Leyenda */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 40, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {(Object.keys(STATUS_LABEL) as TableStatus[]).map((s) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 11, height: 11, borderRadius: 3, background: STATUS_BG[s], border: `1px solid ${STATUS_BORDER[s]}`, flexShrink: 0 }} />
                        <span style={{ fontSize: "0.67rem", color: "rgba(245,241,232,0.38)" }}>{STATUS_LABEL[s]}</span>
                    </div>
                ))}
            </div>

            {/* Modal bloquear / liberar área completa */}
            {sectionTarget && (() => {
                const allBlocked = sectionTarget.tables.length > 0 && sectionTarget.tables.every((t) => t.status === "walk_in");
                return (
                    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                        onClick={(e) => { if (e.target === e.currentTarget) setSectionTarget(null); }}
                    >
                        <div style={{ background: "#1a2628", border: "1px solid rgba(180,60,180,0.3)", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 16 }}>
                            <p style={{ margin: 0, fontSize: "0.62rem", letterSpacing: "0.22em", color: "#d080d0", fontWeight: 700, textTransform: "uppercase" }}>
                                {allBlocked ? "Liberar Área Completa" : "Bloquear Área Completa"}
                            </p>
                            <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
                                Sección {sectionTarget.name} · {sectionTarget.tables.length} mesas
                            </p>
                            {!allBlocked && (
                                <div>
                                    <label style={{ fontSize: "0.65rem", letterSpacing: "0.15em", color: "rgba(245,241,232,0.4)", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 6 }}>
                                        Motivo (opcional)
                                    </label>
                                    <input
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="Ej. Evento privado, grupo sin reserva…"
                                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#f5f1e8", fontSize: "0.85rem", boxSizing: "border-box" }}
                                    />
                                </div>
                            )}
                            <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={() => setSectionTarget(null)} style={{ flex: 1, padding: "10px 0", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "rgba(245,241,232,0.5)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => toggleSectionBlock(sectionTarget, !allBlocked)}
                                    disabled={blocking}
                                    style={{ flex: 2, padding: "10px 0", background: allBlocked ? "#4caf50" : "#b43cb4", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: "0.82rem", cursor: blocking ? "default" : "pointer", letterSpacing: "0.06em", textTransform: "uppercase", opacity: blocking ? 0.6 : 1 }}
                                >
                                    {blocking ? "…" : allBlocked ? "Liberar área" : "Bloquear área"}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Modal bloquear / liberar mesa individual */}
            {selected && (
                <div
                    style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                    onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
                >
                    <div style={{ background: "#1a2628", border: "1px solid rgba(186,132,60,0.25)", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 16 }}>
                        <p style={{ margin: 0, fontSize: "0.62rem", letterSpacing: "0.22em", color: "#ba843c", fontWeight: 700, textTransform: "uppercase" }}>
                            {selected.status === "walk_in" ? "Liberar Mesa" : "Bloquear Walk-in"}
                        </p>
                        <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                            Mesa #{selected.number} · {selected.capacity} personas
                        </p>

                        {selected.status === "walk_in" && selected.block && (
                            <div style={{ background: "rgba(186,132,60,0.08)", border: "1px solid rgba(186,132,60,0.2)", borderRadius: 8, padding: "10px 14px" }}>
                                <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(245,241,232,0.6)" }}>
                                    Walk-in desde {new Date(selected.block.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                                    {selected.block.note && ` · ${selected.block.note}`}
                                </p>
                            </div>
                        )}

                        {selected.status === "available" && (
                            <div>
                                <label style={{ fontSize: "0.65rem", letterSpacing: "0.15em", color: "rgba(245,241,232,0.4)", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 6 }}>
                                    Nota (opcional)
                                </label>
                                <input
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Ej. 4 personas, sin reserva…"
                                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#f5f1e8", fontSize: "0.85rem", boxSizing: "border-box" }}
                                />
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setSelected(null)} style={{ flex: 1, padding: "10px 0", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "rgba(245,241,232,0.5)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
                                Cancelar
                            </button>
                            <button
                                onClick={() => toggleBlock(selected)}
                                disabled={blocking}
                                style={{ flex: 2, padding: "10px 0", background: selected.status === "walk_in" ? "#4caf50" : "#ba843c", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: "0.82rem", cursor: blocking ? "default" : "pointer", letterSpacing: "0.06em", textTransform: "uppercase", opacity: blocking ? 0.6 : 1 }}
                            >
                                {blocking ? "…" : selected.status === "walk_in" ? "Liberar Mesa" : "Bloquear Walk-in"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── TableCard ────────────────────────────────────────────────────────────────
function TableCard({ table, onClick }: { table: LiveTable; onClick: () => void }) {
    const isClickable = table.status === "available" || table.status === "walk_in";

    return (
        <div
            onClick={isClickable ? onClick : undefined}
            style={{
                width: 110, minHeight: 95, borderRadius: 12, padding: "10px 12px",
                background: STATUS_BG[table.status],
                border: `1.5px solid ${STATUS_BORDER[table.status]}`,
                cursor: isClickable ? "pointer" : "default",
                display: "flex", flexDirection: "column", gap: 3,
                userSelect: "none",
                ...(table.status === "area_blocked" ? { opacity: 0.85 } : {}),
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "1rem", fontWeight: 700 }}>#{table.number}</span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_DOT[table.status], flexShrink: 0 }} />
            </div>
            <span style={{ fontSize: "0.63rem", color: "rgba(245,241,232,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {table.capacity} pers.
            </span>
            <span style={{ fontSize: "0.67rem", fontWeight: 700, color: STATUS_DOT[table.status], textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {STATUS_LABEL[table.status]}
            </span>
            {table.reservation && table.status !== "area_blocked" && (
                <div style={{ marginTop: 2 }}>
                    <p style={{ margin: 0, fontSize: "0.7rem", color: "rgba(245,241,232,0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {table.reservation.guestName}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.63rem", color: "rgba(245,241,232,0.38)" }}>
                        {table.reservation.guests}p · {table.reservation.time}
                    </p>
                </div>
            )}
            {table.block && (
                <p style={{ margin: "2px 0 0", fontSize: "0.63rem", color: "rgba(245,241,232,0.38)" }}>
                    {table.block.note || "Walk-in"}
                </p>
            )}
        </div>
    );
}
