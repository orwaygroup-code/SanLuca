"use client";

import { useState } from "react";
import { CrmPageHead } from "@/components/crm/CrmPageHead";

const CHANNELS = [
  { id: "todos",    label: "Todos"    },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email",    label: "Email"    },
] as const;

const SEGMENTS = ["Clientes frecuentes", "Nuevos (últimos 30 días)", "Inactivos (90+ días)", "Con crédito disponible"];
const FILTERS  = ["Preferencias", "Sección favorita", "Frecuencia", "Sin filtro"];
const CLASSES  = ["Pastas", "Pizza", "Mariscos", "Postres", "Bebidas"];

export default function MarketingPage() {
  const [channel, setChannel]   = useState<typeof CHANNELS[number]["id"]>("todos");
  const [message, setMessage]   = useState("");
  const [segment, setSegment]   = useState(SEGMENTS[0]);
  const [filter,  setFilter]    = useState(FILTERS[0]);
  const [klass,   setKlass]     = useState(CLASSES[0]);
  const [sending, setSending]   = useState(false);
  const [sent,    setSent]      = useState(false);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    // MOCK — reemplazar por POST /api/crm/marketing/send con WhatsApp Business / Resend
    await new Promise((r) => setTimeout(r, 800));
    setSending(false);
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  }

  return (
    <>
      <CrmPageHead accent="MARKETING" title="PANEL" sub="Mensajes masivos en WhatsApp" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Media drop */}
        <div>
          <div style={dropBox}>
            <span style={{ fontSize: "3rem", color: "rgba(245,241,232,0.25)" }}>+</span>
          </div>
          <div style={pillBar}>
            {CHANNELS.map((c) => (
              <button key={c.id} onClick={() => setChannel(c.id)} style={{
                ...pillBtn,
                background: channel === c.id ? "#ba843c" : "transparent",
                color:      channel === c.id ? "#1c2628" : "rgba(245,241,232,0.7)",
                fontWeight: channel === c.id ? 700      : 500,
              }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <div>
          <textarea
            value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe un mensaje"
            style={textarea}
            rows={8}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            <Field label="Enviar a" value={segment} onChange={setSegment} options={SEGMENTS} />
            <Field label="Filtrar por" value={filter} onChange={setFilter} options={FILTERS} />
            <Field label="Clase" value={klass} onChange={setKlass} options={CLASSES} />
          </div>

          <button onClick={handleSend} disabled={sending || !message.trim()} style={{
            ...sendBtn, opacity: sending || !message.trim() ? 0.5 : 1, marginTop: 18,
          }}>
            {sending ? "Enviando…" : sent ? "✓ Enviado (mock)" : "Enviar"}
          </button>
        </div>
      </div>

      <p style={{ marginTop: 26, color: "rgba(245,241,232,0.4)", fontSize: "0.78rem" }}>
        ⓘ Envío simulado. Conectar con WhatsApp Business API + Resend/SendGrid para producción.
      </p>
    </>
  );
}

function Field({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 12 }}>
      <span style={{ color: "rgba(245,241,232,0.7)", fontSize: "0.85rem", fontWeight: 600 }}>{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={select}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

const dropBox: React.CSSProperties = {
  background: "#22302e",
  border: "1px solid rgba(255,255,255,0.04)",
  borderRadius: 14,
  height: 360,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const pillBar: React.CSSProperties = {
  marginTop: 14,
  background: "#22302e",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 999,
  padding: 6,
  display: "flex",
  width: "fit-content",
};
const pillBtn: React.CSSProperties = {
  padding: "8px 22px",
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "0.78rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};
const textarea: React.CSSProperties = {
  width: "100%",
  background: "#22302e",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: "16px 18px",
  color: "#f5f1e8",
  fontFamily: "inherit",
  fontSize: "0.9rem",
  resize: "vertical",
  outline: "none",
  minHeight: 200,
};
const select: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(245,241,232,0.18)",
  borderRadius: 999,
  padding: "9px 16px",
  color: "#f5f1e8",
  fontFamily: "inherit",
  fontSize: "0.82rem",
  cursor: "pointer",
  outline: "none",
};
const sendBtn: React.CSSProperties = {
  padding: "12px 0",
  width: "100%",
  background: "#ba843c",
  border: "none",
  borderRadius: 999,
  color: "#1c2628",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "0.85rem",
};
