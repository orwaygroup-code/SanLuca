"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────
type TableStatus = "available" | "reserved" | "in_progress" | "walk_in" | "area_blocked";

interface LargeGroupInfo {
    id: string; status: string; guestName: string; guests: number; time: string;
}
interface LiveTable {
    id: string; number: number; capacity: number; status: TableStatus;
    reservation: { id: string; status: string; guestName: string; guests: number; time: string } | null;
    block: { note: string | null; createdAt: string } | null;
}
interface LiveSection {
    id: string; name: string; largeGroup: LargeGroupInfo | null; tables: LiveTable[];
}

// ── Status config ─────────────────────────────────────────────────────────────
const S_BG: Record<TableStatus, string> = {
    available:    "#1e2628",
    reserved:     "#1a2d3d",
    in_progress:  "#3a1010",
    walk_in:      "#2e1e08",
    area_blocked: "#2a0d2a",
};
const S_BORDER: Record<TableStatus, string> = {
    available:    "rgba(255,255,255,0.08)",
    reserved:     "rgba(74,158,202,0.55)",
    in_progress:  "rgba(224,85,85,0.8)",
    walk_in:      "rgba(186,132,60,0.75)",
    area_blocked: "rgba(180,60,180,0.7)",
};
const S_DOT: Record<TableStatus, string> = {
    available:    "#4caf50",
    reserved:     "#4a9eca",
    in_progress:  "#e05555",
    walk_in:      "#ba843c",
    area_blocked: "#c060c0",
};
const S_LABEL: Record<TableStatus, string> = {
    available:    "Libre",
    reserved:     "Reservada",
    in_progress:  "En curso",
    walk_in:      "Walk-in",
    area_blocked: "Área bloqueada",
};
const LG_LABEL: Record<string, string> = {
    PENDING: "Pendiente", CONFIRMED: "Confirmada", IN_PROGRESS: "En curso", DELAYED: "Retraso",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function MapaPage() {
    const router = useRouter();
    const [userId,       setUserId]       = useState<string | null>(null);
    const [data,         setData]         = useState<LiveSection[]>([]);
    const [loading,      setLoading]      = useState(true);
    const [lastUpdate,   setLastUpdate]   = useState<Date | null>(null);
    const [selected,     setSelected]     = useState<LiveTable | null>(null);
    const [sectionModal, setSectionModal] = useState<LiveSection | null>(null);
    const [blocking,     setBlocking]     = useState(false);
    const [note,         setNote]         = useState("");
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        } catch { /* silent */ } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (!userId) return;
        fetchMap(userId);
        timerRef.current = setInterval(() => fetchMap(userId), 20_000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [userId, fetchMap]);

    const patchMap = async (body: object) => {
        if (!userId) return;
        setBlocking(true);
        await fetch("/api/admin/map", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": userId },
            body: JSON.stringify(body),
        });
        setBlocking(false);
        setSelected(null);
        setSectionModal(null);
        setNote("");
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

    return (
        <div className="adm-page">

            {/* ── Header ── */}
            <div className="adm-header">
                <h1 className="adm-title">
                    <span className="adm-title--gold">MAPA</span>{" "}
                    <span className="adm-title--white">EN VIVO</span>
                </h1>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {lastUpdate && (
                        <span style={{ fontSize: "0.68rem", color: "rgba(245,241,232,0.3)", marginRight: 4 }}>
                            {lastUpdate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                    )}
                    <button
                        className="adm-logout"
                        onClick={() => userId && fetchMap(userId)}
                        style={{ borderColor: "rgba(186,132,60,0.4)", color: "#ba843c" }}
                    >
                        ↺ Refrescar
                    </button>
                    <button className="adm-logout" onClick={() => router.push("/admin")}>
                        ← Reservas
                    </button>
                </div>
            </div>

            {/* ── Resumen de estados ── */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 32 }}>
                {(Object.keys(S_LABEL) as TableStatus[])
                    .filter((s) => s !== "area_blocked" || counts[s] > 0)
                    .map((s) => (
                        <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", background: S_BG[s], border: `1px solid ${S_BORDER[s]}`, borderRadius: 10 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: S_DOT[s], flexShrink: 0 }} />
                            <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#f5f1e8" }}>{counts[s]}</span>
                            <span style={{ fontSize: "0.68rem", color: "rgba(245,241,232,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>{S_LABEL[s]}</span>
                        </div>
                    ))}
                <span style={{ fontSize: "0.68rem", color: "rgba(245,241,232,0.25)", alignSelf: "center", marginLeft: 4 }}>
                    · se refresca cada 20s
                </span>
            </div>

            {/* ── Mapa por secciones ── */}
            {loading ? (
                <div className="adm-empty">Cargando mesas…</div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
                    {data.map((sec) => {
                        const allBlocked = !sec.largeGroup && sec.tables.length > 0 && sec.tables.every((t) => t.status === "walk_in");
                        return (
                            <div key={sec.id}>
                                {/* Header sección */}
                                <div className="adm-status-header" style={{ marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
                                    <span className="adm-status-dot" style={{ background: sec.largeGroup ? "#c060c0" : "#ba843c" }} />
                                    <span className="adm-status-name" style={{ color: sec.largeGroup ? "#c060c0" : "#ba843c" }}>
                                        {sec.name.toUpperCase()}
                                    </span>
                                    <span className="adm-status-count" style={{ color: "rgba(245,241,232,0.3)" }}>
                                        {sec.tables.length} mesas
                                    </span>

                                    {/* Botón bloquear/liberar área */}
                                    {!sec.largeGroup && (
                                        <button
                                            onClick={() => { setNote(""); setSectionModal(sec); }}
                                            style={{ marginLeft: "auto", padding: "4px 14px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", border: allBlocked ? "1px solid rgba(76,175,80,0.5)" : "1px solid rgba(180,60,180,0.45)", background: allBlocked ? "rgba(76,175,80,0.08)" : "rgba(180,60,180,0.08)", color: allBlocked ? "#4caf50" : "#c060c0" }}
                                        >
                                            {allBlocked ? "🔓 Liberar área" : "🚫 Bloquear área"}
                                        </button>
                                    )}
                                </div>

                                {/* Banner grupo grande */}
                                {sec.largeGroup && (
                                    <div style={{ marginBottom: 14, padding: "12px 16px", background: "rgba(180,60,180,0.07)", border: "1px solid rgba(180,60,180,0.28)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
                                        <span style={{ fontSize: "1.1rem" }}>🚫</span>
                                        <div>
                                            <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color: "#d080d0" }}>
                                                Área completa bloqueada — Grupo grande
                                            </p>
                                            <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "rgba(245,241,232,0.45)" }}>
                                                {sec.largeGroup.guestName} · {sec.largeGroup.guests} personas · {sec.largeGroup.time} · {LG_LABEL[sec.largeGroup.status] ?? sec.largeGroup.status}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Grid de mesas */}
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                    {sec.tables.map((t) => {
                                        const clickable = t.status === "available" || t.status === "walk_in";
                                        return (
                                            <div
                                                key={t.id}
                                                onClick={clickable ? () => { setNote(""); setSelected(t); } : undefined}
                                                style={{
                                                    width: 120, minHeight: 100, borderRadius: 12, padding: "12px 14px",
                                                    background: S_BG[t.status], border: `1.5px solid ${S_BORDER[t.status]}`,
                                                    cursor: clickable ? "pointer" : "default",
                                                    display: "flex", flexDirection: "column", gap: 4,
                                                    transition: "opacity 0.15s, transform 0.1s",
                                                    userSelect: "none",
                                                }}
                                                onMouseEnter={(e) => { if (clickable) (e.currentTarget as HTMLDivElement).style.opacity = "0.8"; }}
                                                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "#f5f1e8" }}>#{t.number}</span>
                                                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: S_DOT[t.status], flexShrink: 0 }} />
                                                </div>
                                                <span style={{ fontSize: "0.65rem", color: "rgba(245,241,232,0.38)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                                    {t.capacity} personas
                                                </span>
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: S_DOT[t.status], textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                                    {S_LABEL[t.status]}
                                                </span>
                                                {t.reservation && t.status !== "area_blocked" && (
                                                    <div style={{ marginTop: 3, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 4 }}>
                                                        <p style={{ margin: 0, fontSize: "0.72rem", color: "rgba(245,241,232,0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                            {t.reservation.guestName}
                                                        </p>
                                                        <p style={{ margin: 0, fontSize: "0.65rem", color: "rgba(245,241,232,0.38)" }}>
                                                            {t.reservation.guests}p · {t.reservation.time}
                                                        </p>
                                                    </div>
                                                )}
                                                {t.block && (
                                                    <p style={{ margin: "2px 0 0", fontSize: "0.65rem", color: "rgba(245,241,232,0.38)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                        {t.block.note || "Walk-in"}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Leyenda ── */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 48, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {(Object.keys(S_LABEL) as TableStatus[]).map((s) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 11, height: 11, borderRadius: 3, background: S_BG[s], border: `1px solid ${S_BORDER[s]}`, flexShrink: 0 }} />
                        <span style={{ fontSize: "0.68rem", color: "rgba(245,241,232,0.35)" }}>{S_LABEL[s]}</span>
                    </div>
                ))}
                <span style={{ fontSize: "0.67rem", color: "rgba(245,241,232,0.2)", marginLeft: "auto" }}>
                    Toca mesa libre o walk-in para gestionar
                </span>
            </div>

            {/* ── Modal: bloquear/liberar sección ── */}
            {sectionModal && (() => {
                const allBlocked = sectionModal.tables.length > 0 && sectionModal.tables.every((t) => t.status === "walk_in");
                return (
                    <Modal onClose={() => setSectionModal(null)}>
                        <p style={modalLabel}>{allBlocked ? "Liberar Área Completa" : "Bloquear Área Completa"}</p>
                        <p style={modalTitle}>Sección {sectionModal.name} · {sectionModal.tables.length} mesas</p>
                        {!allBlocked && (
                            <NoteInput value={note} onChange={setNote} placeholder="Ej. Evento privado, grupo sin reserva…" />
                        )}
                        <ModalActions
                            onCancel={() => setSectionModal(null)}
                            onConfirm={() => patchMap({ sectionId: sectionModal.id, action: allBlocked ? "unblock-section" : "block-section", note: note || undefined })}
                            loading={blocking}
                            confirmColor={allBlocked ? "#4caf50" : "#c060c0"}
                            confirmLabel={allBlocked ? "Liberar área" : "Bloquear área"}
                        />
                    </Modal>
                );
            })()}

            {/* ── Modal: bloquear/liberar mesa individual ── */}
            {selected && (() => {
                const isWalkIn = selected.status === "walk_in";
                return (
                    <Modal onClose={() => setSelected(null)}>
                        <p style={modalLabel}>{isWalkIn ? "Liberar Mesa" : "Bloquear Walk-in"}</p>
                        <p style={modalTitle}>Mesa #{selected.number} · {selected.capacity} personas</p>
                        {isWalkIn && selected.block && (
                            <div style={{ padding: "10px 14px", background: "rgba(186,132,60,0.08)", border: "1px solid rgba(186,132,60,0.2)", borderRadius: 8 }}>
                                <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(245,241,232,0.6)" }}>
                                    Walk-in desde {new Date(selected.block.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                                    {selected.block.note && ` · ${selected.block.note}`}
                                </p>
                            </div>
                        )}
                        {!isWalkIn && (
                            <NoteInput value={note} onChange={setNote} placeholder="Ej. 4 personas, sin reserva…" />
                        )}
                        <ModalActions
                            onCancel={() => setSelected(null)}
                            onConfirm={() => patchMap({ tableId: selected.id, action: isWalkIn ? "unblock" : "block", note: note || undefined })}
                            loading={blocking}
                            confirmColor={isWalkIn ? "#4caf50" : "#ba843c"}
                            confirmLabel={isWalkIn ? "Liberar mesa" : "Bloquear walk-in"}
                        />
                    </Modal>
                );
            })()}
        </div>
    );
}

// ── Shared modal pieces ───────────────────────────────────────────────────────
const modalLabel: React.CSSProperties = { margin: 0, fontSize: "0.62rem", letterSpacing: "0.22em", color: "#ba843c", fontWeight: 700, textTransform: "uppercase" };
const modalTitle: React.CSSProperties = { margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f5f1e8" };

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: "#1a2628", border: "1px solid rgba(186,132,60,0.2)", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 16 }}>
                {children}
            </div>
        </div>
    );
}

function NoteInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
    return (
        <div>
            <label style={{ fontSize: "0.65rem", letterSpacing: "0.15em", color: "rgba(245,241,232,0.4)", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 6 }}>Nota (opcional)</label>
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#f5f1e8", fontSize: "0.85rem", boxSizing: "border-box" }} />
        </div>
    );
}

function ModalActions({ onCancel, onConfirm, loading, confirmColor, confirmLabel }: {
    onCancel: () => void; onConfirm: () => void; loading: boolean; confirmColor: string; confirmLabel: string;
}) {
    return (
        <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "rgba(245,241,232,0.5)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
                Cancelar
            </button>
            <button onClick={onConfirm} disabled={loading} style={{ flex: 2, padding: "10px 0", background: confirmColor, border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: "0.82rem", cursor: loading ? "default" : "pointer", letterSpacing: "0.06em", textTransform: "uppercase", opacity: loading ? 0.6 : 1 }}>
                {loading ? "…" : confirmLabel}
            </button>
        </div>
    );
}
