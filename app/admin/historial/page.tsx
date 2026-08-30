"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-client";

interface Reservation {
  id: string;
  guestName: string;
  guestPhone: string;
  date: string;
  guests: number;
  sectionPreference: string | null;
  occasion: string | null;
  notes: string | null;
  status: string;
  paymentStatus: string;
  qrToken: string;
  table: { number: number; section: { name: string } } | null;
  user: { name: string; email: string; phone: string };
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Espera pago",
  PENDING:     "Pendiente",
  CONFIRMED:   "Confirmada",
  IN_PROGRESS: "En curso",
  DELAYED:     "Retraso",
  CANCELLED:   "Cancelada",
  NO_SHOW:     "No se presentó",
  COMPLETED:   "Completada",
};
const STATUS_COLOR: Record<string, string> = {
  PENDING_PAYMENT: "#d97706",
  PENDING:     "var(--sl-gold)",
  CONFIRMED:   "#4a9eca",
  IN_PROGRESS: "var(--sl-ok)",
  DELAYED:     "var(--sl-danger-strong)",
  CANCELLED:   "var(--sl-danger-hover)",
  NO_SHOW:     "#c0392b",
  COMPLETED:   "rgb(var(--sl-cream-rgb) / 0.5)",
};
const ACTIVE_STATUSES = ["PENDING_PAYMENT", "PENDING", "CONFIRMED", "IN_PROGRESS", "DELAYED"];

export default function HistorialPage() {
  const router = useRouter();
  const session = useSession();
  const [items, setItems]       = useState<Reservation[]>([]);
  const [loading, setLoad]      = useState(true);
  const [filter, setFilter]     = useState<"todas" | "activas" | "CANCELLED" | "NO_SHOW" | "COMPLETED">("todas");
  const [search, setSearch]     = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function load() {
    setLoad(true);
    try {
      const r = await fetch("/api/admin/reservations?all=1", { credentials: "same-origin" });
      const d = await r.json();
      if (d.success) setItems(d.data);
    } finally {
      setLoad(false);
    }
  }
  useEffect(() => {
    if (session.loading) return;
    const role = session.user?.role;
    if (role !== "ADMIN" && role !== "HOSTES") { router.replace("/login?mode=login"); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.loading, session.user]);

  async function remove(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/admin/reservations/${id}`, { method: "DELETE", credentials: "same-origin" });
      setItems((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  }

  const filtered = items.filter((r) => {
    if (filter === "activas" && !ACTIVE_STATUSES.includes(r.status))    return false;
    if (filter !== "todas" && filter !== "activas" && r.status !== filter) return false;
    if (search && !r.guestName.toLowerCase().includes(search.toLowerCase()) && !r.guestPhone.includes(search)) return false;
    return true;
  });

  const counts = {
    todas:     items.length,
    activas:   items.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
    CANCELLED: items.filter((r) => r.status === "CANCELLED").length,
    NO_SHOW:   items.filter((r) => r.status === "NO_SHOW").length,
    COMPLETED: items.filter((r) => r.status === "COMPLETED").length,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--sl-bg)", color: "var(--sl-cream)", padding: "32px 20px", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <Link href="/admin" style={{ color: "rgb(var(--sl-gold-rgb) / 0.8)", fontSize: "0.75rem", textDecoration: "none", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              ← Panel admin
            </Link>
            <h1 style={{ margin: "6px 0 0", fontSize: "1.6rem", letterSpacing: "0.05em" }}>Historial de Reservas</h1>
            <p style={{ margin: "4px 0 0", color: "rgb(var(--sl-cream-rgb) / 0.55)", fontSize: "0.82rem" }}>
              Todas las reservas (pasadas y futuras). Solo se pueden eliminar las terminadas/canceladas para preservar el registro CRM.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {([
            ["todas",     `Todas (${counts.todas})`],
            ["activas",   `Activas (${counts.activas})`],
            ["COMPLETED", `Completadas (${counts.COMPLETED})`],
            ["CANCELLED", `Canceladas (${counts.CANCELLED})`],
            ["NO_SHOW",   `No-show (${counts.NO_SHOW})`],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k as typeof filter)} style={{
              padding: "8px 16px", borderRadius: 999, border: "1px solid",
              background:   filter === k ? "rgb(var(--sl-gold-rgb) / 0.18)" : "transparent",
              borderColor:  filter === k ? "var(--sl-gold)"               : "rgb(var(--sl-cream-rgb) / 0.18)",
              color:        filter === k ? "var(--sl-gold)"               : "rgb(var(--sl-cream-rgb) / 0.65)",
              fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase",
              cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
            }}>
              {label}
            </button>
          ))}
          <input
            className="adm-historial-search"
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nombre o teléfono"
            style={{ padding: "10px 14px", background: "var(--sl-panel)", border: "1px solid rgb(var(--sl-gold-rgb) / 0.25)", borderRadius: 8, color: "var(--sl-cream)", fontFamily: "inherit", fontSize: "0.82rem" }}
          />
        </div>

        {/* Lista */}
        {loading ? (
          <p style={{ textAlign: "center", color: "rgb(var(--sl-cream-rgb) / 0.4)", padding: 40 }}>Cargando…</p>
        ) : filtered.length === 0 ? (
          <div style={{ background: "var(--sl-panel)", border: "1px solid rgb(var(--sl-veil-rgb) / 0.04)", borderRadius: 12, padding: 60, textAlign: "center", color: "rgb(var(--sl-cream-rgb) / 0.4)" }}>
            No hay reservas en este filtro
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((r) => {
              const date  = new Date(r.date);
              const color = STATUS_COLOR[r.status];
              return (
                <div key={r.id} className="adm-historial-row" style={{
                  background: "var(--sl-panel)",
                  border: `1px solid rgb(var(--sl-veil-rgb) / 0.04)`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                }}>
                  <span style={{ padding: "4px 12px", border: `1px solid ${color}`, color, borderRadius: 999, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {STATUS_LABEL[r.status]}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{r.guestName}</div>
                    <div style={{ fontSize: "0.72rem", color: "rgb(var(--sl-cream-rgb) / 0.5)", marginTop: 2 }}>
                      {date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })} ·{" "}
                      {date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · {r.guests} pers · {r.sectionPreference ?? "—"} · {r.guestPhone}
                    </div>
                  </div>
                  {r.table && (
                    <span style={{ fontSize: "0.72rem", color: "rgb(var(--sl-cream-rgb) / 0.55)" }}>
                      Mesa #{r.table.number}
                    </span>
                  )}
                  {r.occasion && (
                    <span style={{ fontSize: "0.7rem", color: "var(--sl-gold)", padding: "3px 10px", border: "1px solid rgb(var(--sl-gold-rgb) / 0.4)", borderRadius: 6 }}>
                      {r.occasion}
                    </span>
                  )}
                  {ACTIVE_STATUSES.includes(r.status) ? (
                    <span style={{ fontSize: "0.65rem", color: "rgb(var(--sl-cream-rgb) / 0.35)", fontStyle: "italic" }}>
                      Activa
                    </span>
                  ) : confirmId === r.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => remove(r.id)} disabled={deleting === r.id} style={btnDanger}>
                        {deleting === r.id ? "…" : "Confirmar"}
                      </button>
                      <button onClick={() => setConfirmId(null)} style={btnGhost}>Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(r.id)} style={btnGhost}>Eliminar</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p style={{ marginTop: 24, color: "rgb(var(--sl-cream-rgb) / 0.4)", fontSize: "0.75rem" }}>
          ⓘ Eliminar borra la reserva permanentemente. Si quieres conservar el registro para CRM, no la elimines — quedará en la BD para análisis.
        </p>
      </div>
    </div>
  );
}

const btnDanger: React.CSSProperties = {
  padding: "6px 12px", background: "var(--sl-danger-hover)", border: "none", borderRadius: 6,
  color: "#fff", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em",
};
const btnGhost: React.CSSProperties = {
  padding: "6px 12px", background: "transparent", border: "1px solid rgb(var(--sl-cream-rgb) / 0.18)", borderRadius: 6,
  color: "rgb(var(--sl-cream-rgb) / 0.7)", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em",
};
