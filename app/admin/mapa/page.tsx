"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────
type TableStatus = "available" | "reserved" | "in_progress" | "walk_in";

interface LiveTable {
    id:       string;
    number:   number;
    capacity: number;
    status:   TableStatus;
    reservation: { id: string; status: string; guestName: string; guests: number; time: string } | null;
    block:       { note: string | null; createdAt: string } | null;
}

interface LiveSection {
    id:     string;
    name:   string;
    tables: LiveTable[];
}

// ── Colors ────────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<TableStatus, string> = {
    available:   "#2c3537",
    reserved:    "#2a3d50",
    in_progress: "#5a1a1a",
    walk_in:     "#3d2a10",
};
const STATUS_BORDER: Record<TableStatus, string> = {
    available:   "rgba(255,255,255,0.08)",
    reserved:    "rgba(74,158,202,0.6)",
    in_progress: "rgba(224,85,85,0.8)",
    walk_in:     "rgba(186,132,60,0.8)",
};
const STATUS_LABEL: Record<TableStatus, string> = {
    available:   "Libre",
    reserved:    "Reservada",
    in_progress: "En curso",
    walk_in:     "Walk-in",
};
const STATUS_DOT: Record<TableStatus, string> = {
    available:   "#4caf50",
    reserved:    "#4a9eca",
    in_progress: "#e05555",
    walk_in:     "#ba843c",
};

// ── Main component ────────────────────────────────────────────────────────────
export default function MapaPage() {
    const router  = useRouter();
    const [userId, setUserId]   = useState<string | null>(null);
    const [data,   setData]     = useState<LiveSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [selected, setSelected]     = useState<LiveTable | null>(null);
    const [blocking, setBlocking]     = useState(false);
    const [note,     setNote]         = useState("");
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

    if (!userId) return null;

    const allTables  = data.flatMap((s) => s.tables);
    const counts = {
        available:   allTables.filter((t) => t.status === "available").length,
        reserved:    allTables.filter((t) => t.status === "reserved").length,
        in_progress: allTables.filter((t) => t.status === "in_progress").length,
        walk_in:     allTables.filter((t) => t.status === "walk_in").length,
    };

    return (
        <div style={{ minHeight: "100vh", background: "#111d1f", color: "#f5f1e8", fontFamily: "var(--font-cormorant, serif)", padding: "24px 16px" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                    <p style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.25em", color: "#ba843c", fontWeight: 700, textTransform: "uppercase" }}>San Luca</p>
                    <h1 style={{ margin: "4px 0 0", fontSize: "1.4rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Mapa en Vivo</h1>
                    {lastUpdate && (
                        <p style={{ margin: "4px 0 0", fontSize: "0.7rem", color: "rgba(245,241,232,0.3)" }}>
                            Actualizado: {lastUpdate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · se refresca cada 20s
                        </p>
                    )}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button
                        onClick={() => userId && fetchMap(userId)}
                        style={{ padding: "8px 16px", background: "rgba(186,132,60,0.15)", border: "1px solid rgba(186,132,60,0.4)", borderRadius: 8, color: "#ba843c", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                    >
                        ↺ Refrescar
                    </button>
                    <button
                        onClick={() => router.push("/admin")}
                        style={{ padding: "8px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(245,241,232,0.5)", fontSize: "0.78rem", cursor: "pointer" }}
                    >
                        ← Reservas
                    </button>
                </div>
            </div>

            {/* Resumen */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
                {(Object.keys(counts) as TableStatus[]).map((s) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: STATUS_COLOR[s], border: `1px solid ${STATUS_BORDER[s]}`, borderRadius: 10 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_DOT[s], flexShrink: 0 }} />
                        <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>{counts[s]}</span>
                        <span style={{ fontSize: "0.72rem", color: "rgba(245,241,232,0.55)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{STATUS_LABEL[s]}</span>
                    </div>
                ))}
            </div>

            {/* Mapa por secciones */}
            {loading ? (
                <p style={{ textAlign: "center", color: "rgba(245,241,232,0.35)", marginTop: 60 }}>Cargando mesas…</p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                    {data.map((sec) => (
                        <div key={sec.id}>
                            <p style={{ margin: "0 0 12px", fontSize: "0.65rem", letterSpacing: "0.2em", color: "#ba843c", fontWeight: 700, textTransform: "uppercase" }}>
                                {sec.name}
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                {sec.tables.map((t) => (
                                    <TableCard key={t.id} table={t} onClick={() => {
                                        if (t.status === "in_progress" || t.status === "reserved") return;
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
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 36, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {(Object.keys(STATUS_LABEL) as TableStatus[]).map((s) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: STATUS_COLOR[s], border: `1px solid ${STATUS_BORDER[s]}`, flexShrink: 0 }} />
                        <span style={{ fontSize: "0.68rem", color: "rgba(245,241,232,0.4)" }}>{STATUS_LABEL[s]}</span>
                    </div>
                ))}
                <p style={{ fontSize: "0.68rem", color: "rgba(245,241,232,0.3)", margin: 0, marginLeft: "auto" }}>
                    Toca una mesa libre o walk-in para bloquear/desbloquear
                </p>
            </div>

            {/* Modal de bloqueo */}
            {selected && (
                <div
                    style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                    onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
                >
                    <div style={{ background: "#1a2628", border: "1px solid rgba(186,132,60,0.25)", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 16 }}>
                        <p style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.2em", color: "#ba843c", fontWeight: 700, textTransform: "uppercase" }}>
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
                width: 110, minHeight: 90, borderRadius: 12, padding: "10px 12px",
                background: STATUS_COLOR[table.status],
                border: `1.5px solid ${STATUS_BORDER[table.status]}`,
                cursor: isClickable ? "pointer" : "default",
                display: "flex", flexDirection: "column", gap: 4,
                transition: "opacity 0.15s",
                opacity: 1,
                userSelect: "none",
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "1rem", fontWeight: 700 }}>#{table.number}</span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_DOT[table.status], flexShrink: 0 }} />
            </div>
            <span style={{ fontSize: "0.65rem", color: "rgba(245,241,232,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {table.capacity} personas
            </span>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: STATUS_DOT[table.status], textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {STATUS_LABEL[table.status]}
            </span>
            {table.reservation && (
                <div style={{ marginTop: 2 }}>
                    <p style={{ margin: 0, fontSize: "0.7rem", color: "rgba(245,241,232,0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {table.reservation.guestName}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.65rem", color: "rgba(245,241,232,0.4)" }}>
                        {table.reservation.guests}p · {table.reservation.time}
                    </p>
                </div>
            )}
            {table.block && (
                <p style={{ margin: "2px 0 0", fontSize: "0.65rem", color: "rgba(245,241,232,0.4)" }}>
                    {table.block.note || "Walk-in"}
                </p>
            )}
        </div>
    );
}
