"use client";

import { useEffect, useState } from "react";
import { CrmPageHead } from "@/components/crm/CrmPageHead";

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  visits: number;
  channel: "google" | "email";
}

interface Reservation {
  id: string;
  status: string;
  date: string;
  guests: number;
  duration: number;
  guestName: string;
  guestPhone: string;
  sectionPreference: string | null;
  occasion: string | null;
  notes: string | null;
  isLargeGroup: boolean;
  requiresPayment: boolean;
  paymentStatus: string;
  amountPaid: number;
  creditUsed: number;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  checkedInAt: string | null;
  tables: number[];
  tableSection: string | null;
}

interface Detail {
  user: { id: string; name: string; email: string; phone: string; channel: string; createdAt: string };
  stats: { totalVisits: number; confirmed: number; cancelled: number; lastReservation: string | null };
  preferences: { sections: { label: string; value: number }[]; occasions: { label: string; value: number }[] };
  reservations: Reservation[];
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Espera pago",
  PENDING:     "Pendiente",
  CONFIRMED:   "Confirmada",
  IN_PROGRESS: "En curso",
  DELAYED:     "Con retraso",
  CANCELLED:   "Cancelada",
  COMPLETED:   "Completada",
  NO_SHOW:     "No se presentó",
};
const STATUS_COLOR: Record<string, string> = {
  PENDING_PAYMENT: "#d97706",
  PENDING:     "#ba843c",
  CONFIRMED:   "#4a9eca",
  IN_PROGRESS: "#5fa15f",
  DELAYED:     "#e05555",
  CANCELLED:   "rgba(245,241,232,0.4)",
  COMPLETED:   "rgba(245,241,232,0.5)",
  NO_SHOW:     "#c0392b",
};

export default function UsuariosPage() {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [search, setSearch]     = useState("");
  const [channel, setChannel]   = useState<"todos" | "google" | "email">("todos");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail]     = useState<Detail | null>(null);

  function authHeaders() {
    const id = typeof window !== "undefined" ? localStorage.getItem("userId") : "";
    return { "x-user-id": id ?? "" };
  }

  useEffect(() => {
    const params = new URLSearchParams({ search, channel });
    fetch(`/api/crm/users?${params}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users ?? []);
        if (d.users?.[0] && !selected) setSelected(d.users[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, channel]);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    fetch(`/api/crm/users?id=${selected}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setDetail(d.error ? null : d));
  }, [selected]);

  return (
    <>
      <CrmPageHead accent="DATOS" title="DE USUARIO" sub="Clasificación de datos por usuarios" />

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
        {/* Sidebar list */}
        <div>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(245,241,232,0.4)" }}>🔍</span>
            <input
              value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar"
              style={{ width: "100%", padding: "12px 14px 12px 38px", background: "transparent", border: "1px solid rgba(245,241,232,0.18)", borderRadius: 999, color: "#f5f1e8", fontFamily: "inherit", fontSize: "0.85rem" }}
            />
          </div>

          <div style={{ display: "flex", background: "#22302e", borderRadius: 999, padding: 4, marginBottom: 12 }}>
            {(["todos", "google", "email"] as const).map((c) => (
              <button key={c} onClick={() => setChannel(c)} style={{
                flex: 1, padding: "8px 0", border: "none", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
                background: channel === c ? "#ba843c" : "transparent",
                color:      channel === c ? "#1c2628" : "rgba(245,241,232,0.6)",
                fontWeight: channel === c ? 700 : 500, fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                {c === "todos" ? "Todos" : c === "google" ? "Google" : "Email"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {users.map((u) => (
              <button key={u.id} onClick={() => setSelected(u.id)} style={{
                ...userItem,
                background: selected === u.id ? "#2a3a37" : "#22302e",
                borderColor: selected === u.id ? "rgba(186,132,60,0.45)" : "rgba(255,255,255,0.04)",
              }}>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#f5f1e8" }}>{u.name || "Sin nombre"}</div>
                  <div style={{ fontSize: "0.72rem", color: "rgba(245,241,232,0.5)", marginTop: 2 }}>{u.visits} visita{u.visits === 1 ? "" : "s"}</div>
                </div>
                {selected !== u.id && <span style={{ color: "#ba843c", fontSize: "0.6rem" }}>●</span>}
              </button>
            ))}
            {users.length === 0 && (
              <p style={{ color: "rgba(245,241,232,0.4)", textAlign: "center", padding: 24 }}>Sin usuarios</p>
            )}
          </div>
        </div>

        {/* Detail */}
        <div>
          {detail ? <UserDetail d={detail} /> : <div style={{ color: "rgba(245,241,232,0.4)" }}>Selecciona un usuario</div>}
        </div>
      </div>
    </>
  );
}

function UserDetail({ d }: { d: Detail }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter,   setFilter]   = useState<"todas" | "activas" | "completadas" | "canceladas">("todas");

  const filtered = d.reservations.filter((r) => {
    if (filter === "todas")       return true;
    if (filter === "activas")     return ["PENDING", "PENDING_PAYMENT", "CONFIRMED", "IN_PROGRESS", "DELAYED"].includes(r.status);
    if (filter === "completadas") return r.status === "COMPLETED";
    if (filter === "canceladas")  return ["CANCELLED", "NO_SHOW"].includes(r.status);
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 92, height: 92, borderRadius: "50%", background: "#f5f1e8", color: "#1c2628", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.4rem", flexShrink: 0 }}>👤</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: "2rem", color: "#f5f1e8", fontWeight: 500, letterSpacing: "0.02em" }}>{d.user.name || "Sin nombre"}</h2>
          <div style={{ marginTop: 8, color: "rgba(245,241,232,0.7)", fontSize: "0.85rem" }}>
            📞 {d.user.phone || "—"} &nbsp;&nbsp; ✉ {d.user.email}
          </div>
          <div style={{ marginTop: 4, color: "rgba(186,132,60,0.85)", fontSize: "0.78rem" }}>
            🗓 Cliente desde {new Date(d.user.createdAt).toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
          </div>
        </div>
        <span style={{ ...badgePill, color: "#ba843c", borderColor: "#ba843c", textTransform: "uppercase" }}>{d.user.channel}</span>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Stat label="Total reservas" big={d.stats.totalVisits} sub={d.stats.lastReservation ? `Última: ${new Date(d.stats.lastReservation).toLocaleDateString("es-MX")}` : ""} />
        <Stat label="Confirmadas"     big={d.stats.confirmed} accent />
        <Stat label="Canceladas / NS" big={d.stats.cancelled} bad />
        <Stat label="Cliente desde"   big={new Date(d.user.createdAt).toLocaleDateString("es-MX", { month: "short", year: "2-digit" })} small />
      </div>

      {/* Preferences */}
      <Panel title="Preferencias del comensal">
        {d.preferences.occasions.length === 0 && d.preferences.sections.length === 0 ? (
          <p style={muted}>Sin datos suficientes</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div>
              {d.preferences.sections.map((p, i) => <PrefBar key={p.label} label={p.label} value={p.value} max={d.stats.totalVisits} color={["#4a9eca", "#5fa15f", "#d4b35f"][i] ?? "#ba843c"} />)}
            </div>
            <div>
              {d.preferences.occasions.map((p, i) => <Tag key={p.label} text={`${p.label} ×${p.value}`} color={["#ba843c", "#c084fc", "#f472b6"][i] ?? "#ba843c"} />)}
            </div>
          </div>
        )}
      </Panel>

      {/* Reservations */}
      <Panel title={`Reservas (${d.reservations.length})`}>
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {(["todas", "activas", "completadas", "canceladas"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 14px", borderRadius: 999, border: "1px solid",
              background:   filter === f ? "rgba(186,132,60,0.18)" : "transparent",
              borderColor:  filter === f ? "#ba843c"               : "rgba(245,241,232,0.18)",
              color:        filter === f ? "#ba843c"               : "rgba(245,241,232,0.6)",
              fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
            }}>
              {f}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p style={muted}>No hay reservas en esta categoría</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((r) => (
              <ReservationCard key={r.id} r={r} expanded={expanded === r.id} onToggle={() => setExpanded(expanded === r.id ? null : r.id)} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ReservationCard({ r, expanded, onToggle }: { r: Reservation; expanded: boolean; onToggle: () => void }) {
  const date  = new Date(r.date);
  const color = STATUS_COLOR[r.status] ?? "#ba843c";
  const tablesLabel = r.tables.length === 0
    ? "Sin asignar"
    : r.tables.map((n) => `M${n}`).join(" + ");

  return (
    <div style={{
      background: "rgba(28,38,40,0.6)",
      border: `1px solid ${expanded ? color : "rgba(255,255,255,0.04)"}`,
      borderRadius: 10,
      transition: "border-color 0.2s",
    }}>
      <button onClick={onToggle} style={{
        width: "100%", padding: "12px 16px", display: "grid",
        gridTemplateColumns: "auto 1fr auto auto auto", alignItems: "center", gap: 14,
        background: "transparent", border: "none", color: "#f5f1e8", textAlign: "left",
        cursor: "pointer", fontFamily: "inherit",
      }}>
        <span style={{ ...statusDot, background: color }} />
        <div>
          <div style={{ fontSize: "0.88rem", fontWeight: 600, textTransform: "capitalize" }}>
            {date.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </div>
          <div style={{ fontSize: "0.72rem", color: "rgba(245,241,232,0.5)", marginTop: 2 }}>
            {date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · {r.guests} pers · {r.sectionPreference ?? "—"}
          </div>
        </div>
        <span style={{ ...statusBadge, color, borderColor: color }}>{STATUS_LABEL[r.status] ?? r.status}</span>
        {r.requiresPayment && (
          <span style={{ fontSize: "0.68rem", color: "#ba843c", letterSpacing: "0.06em" }}>💳 ${r.amountPaid.toFixed(0)}</span>
        )}
        <span style={{ color: "rgba(245,241,232,0.4)", fontSize: "0.75rem" }}>{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Titular reserva"  v={r.guestName} />
          <Field label="Tel. reserva"     v={r.guestPhone} />
          <Field label="Mesa(s)"          v={`${tablesLabel}${r.tableSection ? ` · ${r.tableSection}` : ""}`} />
          <Field label="Duración"         v={`${r.duration} min`} />
          {r.occasion       && <Field label="Ocasión" v={r.occasion} />}
          {r.isLargeGroup   && <Field label="Tipo" v="Grupo grande (área completa)" />}
          {r.requiresPayment && (
            <>
              <Field label="Pago"    v={`${r.paymentStatus} · $${r.amountPaid.toFixed(0)} MXN`} />
              {r.creditUsed > 0 && <Field label="Crédito usado" v={`$${r.creditUsed.toFixed(0)} MXN`} />}
            </>
          )}
          {r.notes && <Field label="Notas"  v={r.notes}  full />}
          <Field label="Creada"     v={new Date(r.createdAt).toLocaleString("es-MX")} />
          {r.confirmedAt  && <Field label="Confirmada" v={new Date(r.confirmedAt).toLocaleString("es-MX")} />}
          {r.checkedInAt  && <Field label="Check-in"   v={new Date(r.checkedInAt).toLocaleString("es-MX")} />}
          {r.cancelledAt  && <Field label="Cancelada"  v={new Date(r.cancelledAt).toLocaleString("es-MX")} />}
          {r.cancelReason && <Field label="Motivo"     v={r.cancelReason} full />}
        </div>
      )}
    </div>
  );
}

function Field({ label, v, full }: { label: string; v: string; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      <div style={{ fontSize: "0.6rem", letterSpacing: "0.18em", color: "rgba(245,241,232,0.45)", textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "0.82rem", color: "rgba(245,241,232,0.9)" }}>{v}</div>
    </div>
  );
}

const statusDot: React.CSSProperties = { width: 8, height: 8, borderRadius: "50%" };
const statusBadge: React.CSSProperties = {
  padding: "4px 12px", border: "1px solid", borderRadius: 999,
  fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
};

function Stat({ label, big, sub, accent, bad, small }: { label: string; big: number | string; sub?: string; accent?: boolean; bad?: boolean; small?: boolean }) {
  const color = bad ? "#c85050" : accent ? "#ba843c" : "#f5f1e8";
  return (
    <div style={panelStyle}>
      <div style={{ color: "rgba(245,241,232,0.55)", fontSize: "0.68rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: small ? "1.4rem" : "2.2rem", fontWeight: 600, marginTop: 6, color }}>{big}</div>
      {sub && <div style={{ marginTop: 4, fontSize: "0.7rem", color: "rgba(245,241,232,0.45)" }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={panelStyle}>
      <div style={{ color: "rgba(245,241,232,0.55)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function PrefBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: 4 }}>
        <span style={{ color: "rgba(245,241,232,0.85)" }}>{label}</span>
        <span style={{ color: "rgba(245,241,232,0.5)" }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "4px 10px", marginRight: 6, marginTop: 6,
      border: `1px solid ${color}`, color, borderRadius: 999, fontSize: "0.7rem", fontWeight: 600,
    }}>
      {text}
    </span>
  );
}

const userItem: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  padding: "14px 16px", borderRadius: 12, border: "1px solid",
  cursor: "pointer", fontFamily: "inherit",
};
const panelStyle: React.CSSProperties = {
  background: "#22302e", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 14, padding: "18px 20px",
};
const badgePill: React.CSSProperties = {
  padding: "6px 16px", border: "1px solid", borderRadius: 999, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em",
};
const muted: React.CSSProperties = { color: "rgba(245,241,232,0.4)", fontSize: "0.8rem", margin: 0 };
