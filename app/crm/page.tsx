"use client";

import { useEffect, useMemo, useState } from "react";
import { CrmPageHead } from "@/components/crm/CrmPageHead";

interface ChartBar {
  label: string;
  completed: number;
  confirmed: number;
  noShow: number;
  cancelled: number;
}
interface Dashboard {
  cards: {
    users:    { value: number; growth: number };
    messages: { value: number; growth: number; mock?: boolean };
    reservations: { value: number; growth: number };
  };
  chart: ChartBar[];
  conversion: { pct: number; total: number; successful: number; cancelled: number };
  whatsappConversion?: { pct: number; totalConversations: number; converted: number };
}


type Period = "month" | "year" | "week";
type Source = "all" | "WHATSAPP" | "WEB";

const DAY_OPTIONS = [
  { dow: 0, label: "Dom" },
  { dow: 2, label: "Mar" },
  { dow: 3, label: "Mié" },
  { dow: 4, label: "Jue" },
  { dow: 5, label: "Vie" },
  { dow: 6, label: "Sáb" },
];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function thisMonthISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function thisYearISO()  { return String(new Date().getFullYear()); }
function thisWeekISO() {
  const now = new Date();
  const thu = new Date(now); thu.setDate(now.getDate() + 4 - (now.getDay() || 7));
  const y = thu.getFullYear();
  const jan4 = new Date(y, 0, 4);
  const jan4Dow = jan4.getDay() || 7;
  const week1Mon = new Date(y, 0, 4 - jan4Dow + 1);
  const w = Math.floor((thu.getTime() - week1Mon.getTime()) / (7 * 86400000)) + 1;
  return `${y}-W${String(w).padStart(2, "0")}`;
}

export default function CrmDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [value, setValue]   = useState<string>(thisMonthISO());
  const [days, setDays]     = useState<number[]>(DAY_OPTIONS.map((d) => d.dow)); // todos menos lunes
  const [source, setSource] = useState<Source>("all");

  // Cuando cambia el período, reseteo el value al actual de ese tipo
  useEffect(() => {
    if (period === "month") setValue(thisMonthISO());
    else if (period === "year") setValue(thisYearISO());
    else setValue(thisWeekISO());
  }, [period]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("period", period);
    p.set("value", value);
    p.set("days", days.join(","));
    p.set("source", source);
    return p.toString();
  }, [period, value, days, source]);

  useEffect(() => {
    setData(null);
    fetch(`/api/crm/dashboard?${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [qs]);

  function toggleDay(dow: number) {
    setDays((prev) => prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort());
  }

  return (
    <>
      <CrmPageHead accent="PANEL" title="CRM" />

      <Filters
        period={period} setPeriod={setPeriod}
        value={value}   setValue={setValue}
        days={days}     toggleDay={toggleDay}
        source={source} setSource={setSource}
      />

      <div style={grid}>
        <StatCard label="Nuevos usuarios"   value={data?.cards.users.value ?? "—"}        growth={data?.cards.users.growth} icon="👤" />
        <StatCard label="Nuevas reservas"   value={data?.cards.reservations.value ?? "—"} growth={data?.cards.reservations.growth} icon="🍷" />
        <StatCard label="Nuevos mensajes"   value={data?.cards.messages.value ?? "—"}     growth={data?.cards.messages.growth} icon="💬" mock={data?.cards.messages.mock} />
      </div>

      <div className="crm-chart-grid">
        <Chart data={data?.chart ?? []} />
        <Donut conv={data?.conversion} wa={data?.whatsappConversion} />
      </div>
    </>
  );
}

function Filters({
  period, setPeriod, value, setValue, days, toggleDay, source, setSource,
}: {
  period: Period; setPeriod: (p: Period) => void;
  value: string;  setValue: (v: string) => void;
  days: number[]; toggleDay: (dow: number) => void;
  source: Source; setSource: (s: Source) => void;
}) {
  const yearNow = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => yearNow - i);

  return (
    <div className="crm-panel" style={{ marginBottom: 18, padding: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>

        {/* Período */}
        <div style={fieldBox}>
          <span style={fieldLabel}>Período</span>
          <div style={pillRow}>
            {(["week","month","year"] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} style={pill(period === p)}>
                {p === "week" ? "Semana" : p === "month" ? "Mes" : "Año"}
              </button>
            ))}
          </div>
        </div>

        {/* Selector de valor */}
        <div style={fieldBox}>
          <span style={fieldLabel}>{period === "month" ? "Mes" : period === "year" ? "Año" : "Semana"}</span>
          {period === "month" && (
            <input
              type="month" value={value} onChange={(e) => setValue(e.target.value)}
              style={inputStyle}
            />
          )}
          {period === "year" && (
            <select value={value} onChange={(e) => setValue(e.target.value)} style={inputStyle}>
              {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          )}
          {period === "week" && (
            <input
              type="week" value={value} onChange={(e) => setValue(e.target.value)}
              style={inputStyle}
            />
          )}
        </div>

        {/* Días de la semana */}
        <div style={fieldBox}>
          <span style={fieldLabel}>Días</span>
          <div style={pillRow}>
            {DAY_OPTIONS.map((d) => (
              <button key={d.dow} onClick={() => toggleDay(d.dow)} style={pill(days.includes(d.dow))}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Origen */}
        <div style={fieldBox}>
          <span style={fieldLabel}>Origen</span>
          <div style={pillRow}>
            {(["all","WHATSAPP","WEB"] as Source[]).map((s) => (
              <button key={s} onClick={() => setSource(s)} style={pill(source === s)}>
                {s === "all" ? "Todos" : s === "WHATSAPP" ? "WhatsApp" : "Web"}
              </button>
            ))}
          </div>
        </div>

      </div>
      <div style={{ marginTop: 10, fontSize: "0.7rem", color: "rgb(var(--sl-cream-rgb) / 0.4)" }}>
        {period === "month" ? `Mostrando ${MONTHS[parseInt(value.split("-")[1] || "1", 10) - 1] ?? ""} ${value.split("-")[0] ?? ""}` :
         period === "year"  ? `Mostrando todo el año ${value}` :
         period === "week"  ? `Mostrando la semana ${value.replace("-W", " #")}` : ""}
      </div>
    </div>
  );
}

const fieldBox: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const fieldLabel: React.CSSProperties = { color: "rgb(var(--sl-cream-rgb) / 0.55)", fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 };
const pillRow:    React.CSSProperties = { display: "flex", gap: 4, flexWrap: "wrap" };
function pill(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid rgb(var(--sl-veil-rgb) / 0.08)",
    background: active ? "var(--sl-gold)" : "transparent",
    color: active ? "#1c2628" : "rgb(var(--sl-cream-rgb) / 0.75)",
    fontSize: "0.78rem",
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
  };
}
const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.25)",
  border: "1px solid rgb(var(--sl-veil-rgb) / 0.08)",
  borderRadius: 8,
  padding: "7px 10px",
  color: "var(--sl-cream)",
  fontSize: "0.85rem",
};

function StatCard({ label, value, growth, icon, mock }: { label: string; value: number | string; growth?: number; icon: string; mock?: boolean }) {
  const positive = (growth ?? 0) >= 0;
  return (
    <div className="crm-card">
      <div style={{ fontSize: "2rem", opacity: 0.65 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: "rgb(var(--sl-cream-rgb) / 0.55)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontSize: "2.2rem", fontWeight: 600, marginTop: 4, color: "var(--sl-cream)" }}>
          {typeof value === "number" ? value.toLocaleString("es-MX") : value}
        </div>
        {mock ? (
          <div style={{ marginTop: 6, color: "rgb(var(--sl-cream-rgb) / 0.4)", fontSize: "0.7rem" }}>Pendiente de fuente</div>
        ) : growth !== undefined ? (
          <div style={{ marginTop: 6, color: positive ? "#5fa15f" : "#c85050", fontSize: "0.78rem" }}>
            {positive ? "↑" : "↓"} {Math.abs(growth)}% crecimiento
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Chart({ data }: { data: ChartBar[] }) {
  const totalOf = (d: ChartBar) => d.completed + d.confirmed + d.noShow + d.cancelled;
  const max   = Math.max(1, ...data.map(totalOf));
  const total = data.reduce((s, d) => s + totalOf(d), 0);
  const BAR_AREA = 200;

  return (
    <div className="crm-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ color: "rgb(var(--sl-cream-rgb) / 0.55)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
            Reservas del período
          </div>
          <div style={{ color: "var(--sl-cream)", fontSize: "1.4rem", fontWeight: 600, marginTop: 4 }}>
            {total} <span style={{ color: "rgb(var(--sl-cream-rgb) / 0.45)", fontSize: "0.78rem", fontWeight: 400 }}>total</span>
          </div>
        </div>
      </div>

      {/* Scroll horizontal contenido en el panel: con muchas barras el chart
          se desplaza adentro (touch) en vez de empujar toda la página. */}
      <div style={{ overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}>
        <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(26px, 1fr)", alignItems: "end", gap: 10, height: 240, minWidth: "100%" }}>
          {data.map((d, i) => {
            const t = totalOf(d);
            const barH = t === 0 ? 3 : Math.max(10, Math.round((t / max) * BAR_AREA));
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                <div style={{ color: t > 0 ? "var(--sl-gold)" : "rgb(var(--sl-cream-rgb) / 0.3)", fontSize: "0.72rem", fontWeight: 600, marginBottom: 4 }}>
                  {t}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: barH,
                    background: t === 0
                      ? "rgb(var(--sl-cream-rgb) / 0.06)"
                      : "linear-gradient(180deg, #d09a52 0%, var(--sl-gold) 100%)",
                    borderRadius: "4px 4px 0 0",
                    transition: "height 0.4s ease",
                  }}
                />
                <span style={{ marginTop: 8, color: "rgb(var(--sl-cream-rgb) / 0.55)", fontSize: "0.68rem", textTransform: "uppercase" }}>{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      {total === 0 && (
        <p style={{ marginTop: 14, textAlign: "center", color: "rgb(var(--sl-cream-rgb) / 0.4)", fontSize: "0.78rem" }}>
          Sin reservas en este período
        </p>
      )}
    </div>
  );
}

function Donut({ conv, wa }: { conv?: Dashboard["conversion"]; wa?: Dashboard["whatsappConversion"] }) {
  const pct  = conv?.pct ?? 0;
  const waPct = wa?.pct ?? 0;
  const r = 60;
  const c = 2 * Math.PI * r;
  const dash   = (pct / 100) * c;
  const waDash = (waPct / 100) * c;
  return (
    <div className="crm-panel">
      <span style={{ color: "rgb(var(--sl-cream-rgb) / 0.55)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
        Tasa de conversión
      </span>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "20px 0 16px" }}>
        {/* Donut general */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <svg viewBox="0 0 160 160" style={{ width: "100%", maxWidth: 130, height: "auto" }}>
            <circle cx="80" cy="80" r={r} fill="none" stroke="rgb(var(--sl-veil-rgb) / 0.08)" strokeWidth="14" />
            <circle
              cx="80" cy="80" r={r} fill="none"
              stroke="var(--sl-gold)" strokeWidth="14"
              strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
              transform="rotate(-90 80 80)"
            />
            <text x="80" y="88" textAnchor="middle" fill="var(--sl-cream)" fontSize="22" fontWeight="600">{pct}%</text>
          </svg>
          <span style={{ marginTop: 6, fontSize: "0.65rem", color: "rgb(var(--sl-cream-rgb) / 0.55)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
            General
          </span>
        </div>

        {/* Donut WhatsApp */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <svg viewBox="0 0 160 160" style={{ width: "100%", maxWidth: 130, height: "auto" }}>
            <circle cx="80" cy="80" r={r} fill="none" stroke="rgb(var(--sl-veil-rgb) / 0.08)" strokeWidth="14" />
            <circle
              cx="80" cy="80" r={r} fill="none"
              stroke="#25d366" strokeWidth="14"
              strokeDasharray={`${waDash} ${c}`} strokeLinecap="round"
              transform="rotate(-90 80 80)"
            />
            <text x="80" y="88" textAnchor="middle" fill="var(--sl-cream)" fontSize="22" fontWeight="600">{waPct}%</text>
          </svg>
          <span style={{ marginTop: 6, fontSize: "0.65rem", color: "rgb(var(--sl-cream-rgb) / 0.55)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
            WhatsApp
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.72rem", color: "rgb(var(--sl-cream-rgb) / 0.55)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "2px 10px" }}>
          <span style={{ color: "var(--sl-gold)", fontWeight: 600 }}>General</span>
          <span>Total: <b style={{ color: "var(--sl-cream)" }}>{conv?.total ?? 0}</b> · OK: <b style={{ color: "var(--sl-gold)" }}>{conv?.successful ?? 0}</b> · Canc: <b style={{ color: "#c85050" }}>{conv?.cancelled ?? 0}</b></span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "2px 10px" }}>
          <span style={{ color: "#25d366", fontWeight: 600 }}>WhatsApp</span>
          <span>Conv: <b style={{ color: "var(--sl-cream)" }}>{wa?.totalConversations ?? 0}</b> · Reservas: <b style={{ color: "#25d366" }}>{wa?.converted ?? 0}</b></span>
        </div>
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
