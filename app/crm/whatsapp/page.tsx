"use client";

import { useEffect, useState } from "react";
import { CrmPageHead } from "@/components/crm/CrmPageHead";

interface Row {
  id: string;
  name: string;
  phone: string;
  probability: number;
  topic: string;
  status: "CLIENTE" | "ASESORIA" | "FIDELIZADO" | "ESPECTADOR" | "POR CERRAR";
  lastDate: string | null;
  totalReservations: number;
}

const STATUS_COLOR: Record<Row["status"], string> = {
  CLIENTE:     "#5fa15f",
  ASESORIA:    "#d4b35f",
  FIDELIZADO:  "#4a9eca",
  ESPECTADOR:  "rgba(245,241,232,0.5)",
  "POR CERRAR":"#d97706",
};

export default function WhatsappPage() {
  const [rows, setRows]     = useState<Row[]>([]);
  const [loading, setLoad]  = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("userId") : "";
    fetch("/api/crm/whatsapp", { headers: { "x-user-id": id ?? "" } })
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoad(false));
  }, []);

  const filtered = rows.filter(
    (r) => r.phone.includes(search) || r.topic.toLowerCase().includes(search.toLowerCase()) || r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <CrmPageHead accent="WHATSAPP" title="CRM" sub={`Bandeja · ${rows.length} usuario(s) WhatsApp`} />

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

      {loading ? (
        <p style={{ color: "rgba(245,241,232,0.4)", textAlign: "center", padding: 24 }}>Cargando…</p>
      ) : filtered.length === 0 ? (
        <div style={{
          background: "#22302e", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 14,
          padding: 60, textAlign: "center", color: "rgba(245,241,232,0.4)",
        }}>
          {rows.length === 0
            ? "Aún no hay usuarios registrados desde WhatsApp. El bot debe crear usuarios con source=WHATSAPP."
            : "Sin resultados para tu búsqueda"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((r) => (
            <div key={r.id} style={row}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={avatar}>👤</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.name || r.phone}</div>
                  <div style={{ fontSize: "0.7rem", color: "rgba(245,241,232,0.5)" }}>
                    {r.phone} · {r.totalReservations} reserva{r.totalReservations === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <Bar value={r.probability} />
              <div style={{ color: "rgba(245,241,232,0.85)" }}>{r.topic}</div>
              <div style={{ textAlign: "right" }}>
                <span style={{ ...badge, borderColor: STATUS_COLOR[r.status], color: STATUS_COLOR[r.status] }}>{r.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: 26, color: "rgba(245,241,232,0.4)", fontSize: "0.78rem" }}>
        ⓘ Probabilidad y tema derivados de las reservas. Para conversaciones reales conectar n8n / WhatsApp Business API.
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
