"use client";

import { useState } from "react";
import { CrmPageHead } from "@/components/crm/CrmPageHead";

interface Row {
  id: string;
  phone: string;
  probability: number; // 0-100
  topic: string;
  status: "CLIENTE" | "ASESORIA" | "FIDELIZADO" | "ESPECTADOR" | "POR CERRAR";
}

// MOCK — reemplazar con fetch a /api/crm/whatsapp/conversations cuando exista la fuente
const MOCK: Row[] = [
  { id: "1", phone: "+52 449 578 0669", probability: 78, topic: "Reservación",  status: "CLIENTE"     },
  { id: "2", phone: "+52 449 234 4596", probability: 50, topic: "Evento P.",    status: "ASESORIA"    },
  { id: "3", phone: "+52 449 578 7858", probability: 92, topic: "Entrega",      status: "FIDELIZADO"  },
  { id: "4", phone: "+52 449 785 4575", probability: 18, topic: "Informativo",  status: "ESPECTADOR"  },
  { id: "5", phone: "+52 449 586 4758", probability: 70, topic: "Entrega",      status: "POR CERRAR"  },
];

const STATUS_COLOR: Record<Row["status"], string> = {
  CLIENTE:     "#5fa15f",
  ASESORIA:    "#d4b35f",
  FIDELIZADO:  "#4a9eca",
  ESPECTADOR:  "rgba(245,241,232,0.5)",
  "POR CERRAR":"#d97706",
};

export default function WhatsappPage() {
  const [search, setSearch] = useState("");
  const filtered = MOCK.filter((r) => r.phone.includes(search) || r.topic.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <CrmPageHead accent="WHATSAPP" title="CRM" sub="Bandeja de entrada" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 14, marginBottom: 18, alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(245,241,232,0.4)" }}>🔍</span>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar"
            style={{ width: "100%", padding: "12px 14px 12px 38px", background: "#1c2628", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#f5f1e8", fontFamily: "inherit", fontSize: "0.85rem" }}
          />
        </div>
        <BtnPill label="Ordenar por: ETIQUETA" />
        <BtnPill label="Modo entrenamiento" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.4fr 1fr", gap: 14, padding: "0 18px 10px", color: "rgba(245,241,232,0.5)", fontSize: "0.72rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
        <span>Nombre o número</span>
        <span>Probabilidad de cierre</span>
        <span>Tema</span>
        <span style={{ textAlign: "right" }}>Status</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((r) => (
          <div key={r.id} style={row}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={avatar}>👤</div>
              <span style={{ fontWeight: 500 }}>{r.phone}</span>
            </div>
            <div>
              <Bar value={r.probability} />
            </div>
            <div style={{ color: "rgba(245,241,232,0.85)" }}>{r.topic}</div>
            <div style={{ textAlign: "right" }}>
              <span style={{ ...badge, borderColor: STATUS_COLOR[r.status], color: STATUS_COLOR[r.status] }}>{r.status}</span>
            </div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 26, color: "rgba(245,241,232,0.4)", fontSize: "0.78rem" }}>
        ⓘ Datos de ejemplo. Conectar con n8n / WhatsApp Business API para conversaciones reales.
      </p>
    </>
  );
}

function BtnPill({ label }: { label: string }) {
  return (
    <button style={{
      padding: "10px 18px", background: "transparent", border: "1px solid rgba(245,241,232,0.18)",
      borderRadius: 999, color: "rgba(245,241,232,0.8)", fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
    }}>
      {label}
    </button>
  );
}

function Bar({ value }: { value: number }) {
  const color = value >= 75 ? "#5fa15f" : value >= 45 ? "#d4b35f" : value >= 20 ? "#4a9eca" : "#c85050";
  return (
    <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 999 }} />
    </div>
  );
}

const row: React.CSSProperties = {
  background: "#22302e",
  border: "1px solid rgba(255,255,255,0.04)",
  borderRadius: 14,
  padding: "16px 18px",
  display: "grid",
  gridTemplateColumns: "2fr 2fr 1.4fr 1fr",
  alignItems: "center",
  gap: 14,
};
const avatar: React.CSSProperties = {
  width: 36, height: 36, borderRadius: "50%", background: "#f5f1e8", color: "#1c2628",
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
const badge: React.CSSProperties = {
  display: "inline-block", padding: "4px 14px", borderRadius: 999, border: "1px solid",
  fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em",
};
