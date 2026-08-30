"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CrmPageHead } from "@/components/crm/CrmPageHead";
import { dialogAlert } from "@/components/ui/DialogHost";

type ArcoStatus  = "IN_PROGRESS" | "COMPLETED" | "REJECTED";
type ArcoChannel = "APP" | "EMAIL";
type ArcoRight   = "ACCESS" | "RECTIFICATION" | "CANCELLATION" | "OPPOSITION";

interface ArcoRow {
  id:                 string;
  folio:              string;
  receivedAt:         string;
  channel:            ArcoChannel;
  rightExercised:     ArcoRight;
  requesterEmail:     string;
  requesterName:      string | null;
  identityVerifiedAt: string | null;
  evaluationResult:   string | null;
  executedAt:         string | null;
  executedBy:         string | null;
  notifiedAt:         string | null;
  status:             ArcoStatus;
  notes:              string | null;
  createdAt:          string;
  updatedAt:          string;
}

const STATUS_LABEL: Record<ArcoStatus, string> = {
  IN_PROGRESS: "En proceso",
  COMPLETED:   "Completada",
  REJECTED:    "Rechazada",
};
const STATUS_COLOR: Record<ArcoStatus, string> = {
  IN_PROGRESS: "#ba843c",
  COMPLETED:   "#5fa15f",
  REJECTED:    "#e05555",
};
const RIGHT_LABEL: Record<ArcoRight, string> = {
  ACCESS:        "Acceso",
  RECTIFICATION: "Rectificación",
  CANCELLATION:  "Cancelación",
  OPPOSITION:    "Oposición",
};
const CHANNEL_LABEL: Record<ArcoChannel, string> = {
  APP:   "App",
  EMAIL: "Correo",
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ArcoPage() {
  const [rows, setRows]       = useState<ArcoRow[]>([]);
  const [counts, setCounts]   = useState({ all: 0, IN_PROGRESS: 0, COMPLETED: 0, REJECTED: 0 });
  const [status, setStatus]   = useState<ArcoStatus | "ALL">("ALL");
  const [channel, setChannel] = useState<ArcoChannel | "ALL">("ALL");
  const [search, setSearch]   = useState("");
  const [from, setFrom]       = useState("");
  const [to, setTo]           = useState("");
  const [selected, setSelected] = useState<ArcoRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status  !== "ALL") params.set("status", status);
    if (channel !== "ALL") params.set("channel", channel);
    if (search)            params.set("search", search);
    if (from)              params.set("from", from);
    if (to)                params.set("to", to);
    try {
      const r = await fetch(`/api/crm/arco?${params}`, { credentials: "same-origin" });
      const d = await r.json();
      setRows(d.requests ?? []);
      setCounts(d.counts ?? { all: 0, IN_PROGRESS: 0, COMPLETED: 0, REJECTED: 0 });
    } finally {
      setLoading(false);
    }
  }, [status, channel, search, from, to]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows, [rows]);

  async function patchRow(id: string, body: Record<string, unknown>) {
    const r = await fetch(`/api/crm/arco/${id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) {
      void dialogAlert(`Error: ${d.error ?? "patch_failed"}`);
      return;
    }
    setSelected(d.request);
    await load();
  }

  return (
    <div style={page}>
      <CrmPageHead accent="Registro" title="ARCO" sub="Solicitudes de derechos de protección de datos" />

      <div style={statsRow}>
        <Stat label="Total"       value={counts.all}          />
        <Stat label="En proceso"  value={counts.IN_PROGRESS}  color={STATUS_COLOR.IN_PROGRESS} />
        <Stat label="Completadas" value={counts.COMPLETED}    color={STATUS_COLOR.COMPLETED}   />
        <Stat label="Rechazadas"  value={counts.REJECTED}     color={STATUS_COLOR.REJECTED}    />
      </div>

      <div style={filters}>
        <div style={filterCol}>
          <label style={lab}>Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ArcoStatus | "ALL")} style={ctrl}>
            <option value="ALL">Todos</option>
            <option value="IN_PROGRESS">En proceso</option>
            <option value="COMPLETED">Completada</option>
            <option value="REJECTED">Rechazada</option>
          </select>
        </div>
        <div style={filterCol}>
          <label style={lab}>Canal</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value as ArcoChannel | "ALL")} style={ctrl}>
            <option value="ALL">Todos</option>
            <option value="APP">App</option>
            <option value="EMAIL">Correo</option>
          </select>
        </div>
        <div style={filterCol}>
          <label style={lab}>Desde</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={ctrl} />
        </div>
        <div style={filterCol}>
          <label style={lab}>Hasta</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={ctrl} />
        </div>
        <div style={{ ...filterCol, flex: 1, minWidth: 180 }}>
          <label style={lab}>Buscar (folio / correo / nombre)</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ARCO-2026-..."
            style={ctrl}
          />
        </div>
        <div style={{ alignSelf: "flex-end" }}>
          <button onClick={() => setShowNew(true)} style={primaryBtn}>+ Nueva (correo)</button>
        </div>
      </div>

      {loading && <div style={{ color: "rgba(245,241,232,0.5)", marginTop: 12 }}>Cargando…</div>}

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Folio</th>
              <th style={th}>Recibida</th>
              <th style={th}>Canal</th>
              <th style={th}>Derecho</th>
              <th style={th}>Solicitante</th>
              <th style={th}>Estado</th>
              <th style={th}>Ejecutada</th>
              <th style={th}>Notificada</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                style={{ ...tr, background: selected?.id === r.id ? "rgba(186,132,60,0.08)" : "transparent" }}
              >
                <td style={{ ...td, fontFamily: "ui-monospace, monospace", color: "#d09a52" }}>{r.folio}</td>
                <td style={td}>{fmt(r.receivedAt)}</td>
                <td style={td}>{CHANNEL_LABEL[r.channel]}</td>
                <td style={td}>{RIGHT_LABEL[r.rightExercised]}</td>
                <td style={td}>
                  <div>{r.requesterName ?? "—"}</div>
                  <div style={{ fontSize: "0.78rem", color: "rgba(245,241,232,0.5)" }}>{r.requesterEmail}</div>
                </td>
                <td style={td}>
                  <span style={{ ...badge, color: STATUS_COLOR[r.status], borderColor: STATUS_COLOR[r.status] }}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td style={td}>{fmt(r.executedAt)}</td>
                <td style={td}>{fmt(r.notifiedAt)}</td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ ...td, textAlign: "center", color: "rgba(245,241,232,0.4)", padding: 32 }}>
                  Sin solicitudes que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <DetailDrawer row={selected} onClose={() => setSelected(null)} onPatch={(b) => patchRow(selected.id, b)} />}
      {showNew && (
        <NewRequestModal
          onClose={() => setShowNew(false)}
          onCreated={async () => { setShowNew(false); await load(); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={statBox}>
      <div style={{ fontSize: "1.6rem", fontWeight: 600, color: color ?? "#f5f1e8" }}>{value}</div>
      <div style={{ fontSize: "0.72rem", color: "rgba(245,241,232,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
    </div>
  );
}

function DetailDrawer({
  row,
  onClose,
  onPatch,
}: {
  row:     ArcoRow;
  onClose: () => void;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [evaluation, setEvaluation] = useState(row.evaluationResult ?? "");
  const [notes,      setNotes]      = useState(row.notes ?? "");

  return (
    <div style={drawerOverlay} role="dialog" aria-modal="true">
      <div style={drawer}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ margin: 0, color: "#d09a52", fontFamily: "ui-monospace, monospace" }}>{row.folio}</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <p style={{ margin: "4px 0 18px", color: "rgba(245,241,232,0.55)", fontSize: "0.85rem" }}>
          {CHANNEL_LABEL[row.channel]} · {RIGHT_LABEL[row.rightExercised]} · Recibida {fmt(row.receivedAt)}
        </p>

        <DetailField label="Solicitante">
          <div>{row.requesterName ?? "—"}</div>
          <div style={{ fontSize: "0.85rem", color: "rgba(245,241,232,0.55)" }}>{row.requesterEmail}</div>
        </DetailField>

        <Stage
          label="1. Identidad verificada"
          at={row.identityVerifiedAt}
          onMark={() => onPatch({ identityVerifiedAt: "now" })}
        />

        <DetailField label="2. Evaluación de procedencia">
          <textarea
            value={evaluation}
            onChange={(e) => setEvaluation(e.target.value)}
            rows={2}
            style={textarea}
            placeholder='"Procedente" / "Improcedente: <motivo>"'
          />
          <button
            style={smallBtn}
            disabled={evaluation === (row.evaluationResult ?? "")}
            onClick={() => onPatch({ evaluationResult: evaluation })}
          >
            Guardar evaluación
          </button>
        </DetailField>

        <Stage
          label="3. Ejecutada"
          at={row.executedAt}
          onMark={() => onPatch({ executedAt: "now" })}
        />

        <Stage
          label="4. Notificada al usuario"
          at={row.notifiedAt}
          onMark={() => onPatch({ notifiedAt: "now" })}
        />

        <DetailField label="Notas">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={textarea}
            placeholder="Observaciones internas…"
          />
          <button
            style={smallBtn}
            disabled={notes === (row.notes ?? "")}
            onClick={() => onPatch({ notes })}
          >
            Guardar notas
          </button>
        </DetailField>

        <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {row.status !== "COMPLETED" && (
            <button style={primaryBtn} onClick={() => onPatch({ status: "COMPLETED" })}>
              Marcar como completada
            </button>
          )}
          {row.status !== "REJECTED" && (
            <button style={dangerBtn} onClick={() => onPatch({ status: "REJECTED" })}>
              Marcar como rechazada
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: "0.75rem", color: "rgba(245,241,232,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color: "#f5f1e8" }}>{children}</div>
    </div>
  );
}

function Stage({ label, at, onMark }: { label: string; at: string | null; onMark: () => void }) {
  return (
    <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <div>
        <div style={{ fontSize: "0.85rem", color: "#f5f1e8" }}>{label}</div>
        <div style={{ fontSize: "0.78rem", color: at ? "#5fa15f" : "rgba(245,241,232,0.4)" }}>
          {at ? `✓ ${fmt(at)}` : "Pendiente"}
        </div>
      </div>
      {!at && <button style={smallBtn} onClick={onMark}>Marcar ahora</button>}
    </div>
  );
}

function NewRequestModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [right, setRight] = useState<ArcoRight>("CANCELLATION");
  const [email, setEmail] = useState("");
  const [name,  setName]  = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setErr(null);
    try {
      const r = await fetch("/api/crm/arco", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel:        "EMAIL",
          rightExercised: right,
          requesterEmail: email,
          requesterName:  name || undefined,
          notes:          notes || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "create_failed");
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error inesperado");
      setSubmitting(false);
    }
  }

  return (
    <div style={drawerOverlay} role="dialog" aria-modal="true">
      <div style={{ ...drawer, maxWidth: 480 }}>
        <h2 style={{ margin: "0 0 16px", color: "#d09a52" }}>Nueva solicitud por correo</h2>
        <p style={{ margin: "0 0 16px", color: "rgba(245,241,232,0.6)", fontSize: "0.85rem" }}>
          Captura una solicitud ARCO recibida en privacidad@sanlucaristorante.com. El folio se asigna automáticamente.
        </p>
        <DetailField label="Derecho ejercido">
          <select value={right} onChange={(e) => setRight(e.target.value as ArcoRight)} style={ctrl}>
            <option value="ACCESS">Acceso</option>
            <option value="RECTIFICATION">Rectificación</option>
            <option value="CANCELLATION">Cancelación</option>
            <option value="OPPOSITION">Oposición</option>
          </select>
        </DetailField>
        <DetailField label="Correo del solicitante *">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={ctrl} />
        </DetailField>
        <DetailField label="Nombre del solicitante">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={ctrl} />
        </DetailField>
        <DetailField label="Notas">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={textarea} />
        </DetailField>
        {err && <div style={{ color: "#e05555", fontSize: "0.85rem", marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={smallBtn} disabled={submitting}>Cancelar</button>
          <button onClick={submit} style={primaryBtn} disabled={submitting || !email}>
            {submitting ? "Creando…" : "Crear solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}

const page: React.CSSProperties = { padding: "32px 40px", color: "#f5f1e8" };
const statsRow: React.CSSProperties = { display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" };
const statBox:  React.CSSProperties = { background: "rgba(245,241,232,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "12px 18px", minWidth: 110 };
const filters:  React.CSSProperties = { display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" };
const filterCol:React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const lab:      React.CSSProperties = { fontSize: "0.7rem", color: "rgba(245,241,232,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" };
const ctrl:     React.CSSProperties = { background: "rgba(245,241,232,0.04)", color: "#f5f1e8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 10px", fontSize: "0.88rem", fontFamily: "inherit", minWidth: 140 };
const tableWrap:React.CSSProperties = { overflowX: "auto", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 };
const table:    React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" };
const th:       React.CSSProperties = { textAlign: "left", padding: "12px 14px", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(245,241,232,0.5)", borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" };
const tr:       React.CSSProperties = { cursor: "pointer", transition: "background 0.15s" };
const td:       React.CSSProperties = { padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "rgba(245,241,232,0.85)", verticalAlign: "top" };
const badge:    React.CSSProperties = { display: "inline-block", padding: "2px 8px", border: "1px solid", borderRadius: 999, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" };
const drawerOverlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(8,12,14,0.7)", display: "flex", justifyContent: "flex-end", zIndex: 999 };
const drawer:   React.CSSProperties = { width: "min(540px, 100%)", maxWidth: "100%", height: "100vh", overflowY: "auto", background: "var(--sl-panel)", borderLeft: "1px solid rgba(255,255,255,0.06)", padding: "28px 28px 40px", boxSizing: "border-box" };
const closeBtn: React.CSSProperties = { background: "transparent", border: "none", color: "rgba(245,241,232,0.5)", fontSize: "1.2rem", cursor: "pointer" };
const textarea: React.CSSProperties = { ...ctrl, width: "100%", boxSizing: "border-box", resize: "vertical", minWidth: 0 };
const smallBtn: React.CSSProperties = { marginTop: 6, padding: "6px 12px", background: "transparent", border: "1px solid rgba(186,132,60,0.4)", color: "#ba843c", borderRadius: 4, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" };
const primaryBtn:React.CSSProperties = { padding: "8px 16px", background: "#ba843c", border: "none", color: "#1c2628", borderRadius: 6, fontSize: "0.88rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const dangerBtn: React.CSSProperties = { padding: "8px 16px", background: "transparent", border: "1px solid #e05555", color: "#e05555", borderRadius: 6, fontSize: "0.88rem", cursor: "pointer", fontFamily: "inherit" };
