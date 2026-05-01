"use client";

import { useEffect, useState } from "react";
import { CrmPageHead } from "@/components/crm/CrmPageHead";

interface Dashboard {
  cards: {
    users:    { value: number; growth: number };
    messages: { value: number; growth: number; mock?: boolean };
    reservations: { value: number; growth: number };
  };
  chart: { label: string; value: number }[];
  conversion: { pct: number; total: number; successful: number; cancelled: number };
}

export default function CrmDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem("userId") ?? "";
    fetch("/api/crm/dashboard", { headers: { "x-user-id": userId } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <>
      <CrmPageHead accent="PANEL" title="CRM" />
      <div style={grid}>
        <StatCard label="Nuevos usuarios"   value={data?.cards.users.value ?? "—"}        growth={data?.cards.users.growth} icon="👤" />
        <StatCard label="Nuevas reservas"   value={data?.cards.reservations.value ?? "—"} growth={data?.cards.reservations.growth} icon="🍷" />
        <StatCard label="Nuevos mensajes"   value={data?.cards.messages.value ?? "—"}     growth={data?.cards.messages.growth} icon="💬" mock={data?.cards.messages.mock} />
      </div>

      <div style={chartGrid}>
        <Chart data={data?.chart ?? []} />
        <Donut conv={data?.conversion} />
      </div>
    </>
  );
}

function StatCard({ label, value, growth, icon, mock }: { label: string; value: number | string; growth?: number; icon: string; mock?: boolean }) {
  const positive = (growth ?? 0) >= 0;
  return (
    <div style={card}>
      <div style={{ fontSize: "2rem", opacity: 0.65 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: "rgba(245,241,232,0.55)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontSize: "2.2rem", fontWeight: 600, marginTop: 4, color: "#f5f1e8" }}>
          {typeof value === "number" ? value.toLocaleString("es-MX") : value}
        </div>
        {mock ? (
          <div style={{ marginTop: 6, color: "rgba(245,241,232,0.4)", fontSize: "0.7rem" }}>Pendiente de fuente</div>
        ) : growth !== undefined ? (
          <div style={{ marginTop: 6, color: positive ? "#5fa15f" : "#c85050", fontSize: "0.78rem" }}>
            {positive ? "↑" : "↓"} {Math.abs(growth)}% crecimiento
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Chart({ data }: { data: { label: string; value: number }[] }) {
  const max   = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ color: "rgba(245,241,232,0.55)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
            Reservas últimos 7 días
          </div>
          <div style={{ color: "#f5f1e8", fontSize: "1.4rem", fontWeight: 600, marginTop: 4 }}>
            {total} <span style={{ color: "rgba(245,241,232,0.45)", fontSize: "0.78rem", fontWeight: 400 }}>total</span>
          </div>
        </div>
        <span style={{ color: "rgba(245,241,232,0.5)", fontSize: "0.75rem" }}>POR DÍA ▾</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, data.length)}, 1fr)`, alignItems: "end", gap: 12, height: 240 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ color: d.value > 0 ? "#ba843c" : "rgba(245,241,232,0.3)", fontSize: "0.75rem", fontWeight: 600, textAlign: "center", marginBottom: 4 }}>
                {d.value}
              </div>
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(2, (d.value / max) * 100)}%`,
                  minHeight: d.value === 0 ? 2 : 8,
                  background: d.value === 0
                    ? "rgba(245,241,232,0.06)"
                    : "linear-gradient(180deg, #d09a52 0%, #ba843c 100%)",
                  borderRadius: "4px 4px 0 0",
                }}
              />
            </div>
            <span style={{ color: "rgba(245,241,232,0.55)", fontSize: "0.7rem", textTransform: "uppercase" }}>{d.label}</span>
          </div>
        ))}
      </div>
      {total === 0 && (
        <p style={{ marginTop: 14, textAlign: "center", color: "rgba(245,241,232,0.4)", fontSize: "0.78rem" }}>
          Sin reservas esta semana
        </p>
      )}
    </div>
  );
}

function Donut({ conv }: { conv?: Dashboard["conversion"] }) {
  const pct = conv?.pct ?? 0;
  const r = 60;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div style={panel}>
      <span style={{ color: "rgba(245,241,232,0.55)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
        Tasa de conversión
      </span>
      <div style={{ display: "flex", justifyContent: "center", margin: "20px 0 16px" }}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
          <circle
            cx="80" cy="80" r={r} fill="none"
            stroke="#ba843c" strokeWidth="14"
            strokeDasharray={`${dash} ${c}`} strokeDashoffset={c / 4} strokeLinecap="round"
            transform="rotate(-90 80 80)"
          />
          <text x="80" y="88" textAnchor="middle" fill="#f5f1e8" fontSize="22" fontWeight="600">{pct}%</text>
        </svg>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "rgba(245,241,232,0.55)" }}>
        <span>Total: <b style={{ color: "#f5f1e8" }}>{conv?.total ?? 0}</b></span>
        <span>OK: <b style={{ color: "#ba843c" }}>{conv?.successful ?? 0}</b></span>
        <span>Canc: <b style={{ color: "#c85050" }}>{conv?.cancelled ?? 0}</b></span>
      </div>
    </div>
  );
}

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 18,
  marginBottom: 22,
};
const chartGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr",
  gap: 18,
};
const card: React.CSSProperties = {
  background: "#22302e",
  border: "1px solid rgba(255,255,255,0.04)",
  borderRadius: 14,
  padding: "20px 22px",
  display: "flex",
  alignItems: "center",
  gap: 18,
};
const panel: React.CSSProperties = {
  background: "#22302e",
  border: "1px solid rgba(255,255,255,0.04)",
  borderRadius: 14,
  padding: "22px 24px",
};
