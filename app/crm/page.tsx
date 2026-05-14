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

const STATUS_COLOR = {
  completed: "#5fa15f", // verde
  confirmed: "#ba843c", // dorado marca
  noShow:    "#d97706", // ámbar
  cancelled: "#c85050", // rojo
} as const;
const STATUS_LABEL = {
  completed: "Completadas",
  confirmed: "Confirmadas",
  noShow:    "No se presentó",
  cancelled: "Canceladas",
} as const;

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
      <div style={{ marginTop: 10, fontSize: "0.7rem", color: "rgba(245,241,232,0.4)" }}>
        {period === "month" ? `Mostrando ${MONTHS[parseInt(value.split("-")[1] || "1", 10) - 1] ?? ""} ${value.split("-")[0] ?? ""}` :
         period === "year"  ? `Mostrando todo el año ${value}` :
         period === "week"  ? `Mostrando la semana ${value.replace("-W", " #")}` : ""}
      </div>
    </div>
  );
}

const fieldBox: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const fieldLabel: React.CSSProperties = { color: "rgba(245,241,232,0.55)", fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 };
const pillRow:    React.CSSProperties = { display: "flex", gap: 4, flexWrap: "wrap" };
function pill(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: active ? "#ba843c" : "transparent",
    color: active ? "#1c2628" : "rgba(245,241,232,0.75)",
    fontSize: "0.78rem",
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
  };
}
const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.25)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: "7px 10px",
  color: "#f5f1e8",
  fontSize: "0.85rem",
  colorScheme: "dark",
};

function StatCard({ label, value, growth, icon, mock }: { label: string; value: number | string; growth?: number; icon: string; mock?: boolean }) {
  const positive = (growth ?? 0) >= 0;
  return (
    <div className="crm-card">
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

function Chart({ data }: { data: ChartBar[] }) {
  const totalOf = (d: ChartBar) => d.completed + d.confirmed + d.noShow + d.cancelled;
  const max   = Math.max(1, ...data.map(totalOf));
  const total = data.reduce((s, d) => s + totalOf(d), 0);
  const BAR_AREA = 200;
  // Orden de apilamiento (de abajo hacia arriba) y color
  const STACK: Array<{ key: keyof Omit<ChartBar, "label">; color: string }> = [
    { key: "completed", color: STATUS_COLOR.completed },
    { key: "confirmed", color: STATUS_COLOR.confirmed },
    { key: "noShow",    color: STATUS_COLOR.noShow    },
    { key: "cancelled", color: STATUS_COLOR.cancelled },
  ];

  return (
    <div className="crm-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ color: "rgba(245,241,232,0.55)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
            Reservas del período
          </div>
          <div style={{ color: "#f5f1e8", fontSize: "1.4rem", fontWeight: 600, marginTop: 4 }}>
            {total} <span style={{ color: "rgba(245,241,232,0.45)", fontSize: "0.78rem", fontWeight: 400 }}>total</span>
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        {(Object.keys(STATUS_COLOR) as Array<keyof typeof STATUS_COLOR>).map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, background: STATUS_COLOR[k], borderRadius: 2, display: "inline-block" }} />
            <span style={{ color: "rgba(245,241,232,0.7)", fontSize: "0.72rem" }}>{STATUS_LABEL[k]}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, data.length)}, 1fr)`, alignItems: "end", gap: 12, height: 240 }}>
        {data.map((d, i) => {
          const t = totalOf(d);
          const barH = t === 0 ? 3 : Math.max(10, Math.round((t / max) * BAR_AREA));
          // altura proporcional de cada segmento dentro de la barra
          const segH = (n: number) => (t === 0 ? 0 : Math.round((n / t) * barH));
          // Para evitar que por redondeo no sume al total, el último segmento absorbe el resto
          const seg0 = segH(d.completed);
          const seg1 = segH(d.confirmed);
          const seg2 = segH(d.noShow);
          const seg3 = barH - seg0 - seg1 - seg2;
          const segs = [
            { key: "completed", h: seg0, color: STACK[0].color, n: d.completed },
            { key: "confirmed", h: seg1, color: STACK[1].color, n: d.confirmed },
            { key: "noShow",    h: seg2, color: STACK[2].color, n: d.noShow    },
            { key: "cancelled", h: seg3, color: STACK[3].color, n: d.cancelled },
          ];
          // Segmento más arriba = el último con valor > 0 (para el border-radius)
          const lastIdx = (() => { for (let k = segs.length - 1; k >= 0; k--) if (segs[k].n > 0) return k; return -1; })();

          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              <div style={{ color: t > 0 ? "#f5f1e8" : "rgba(245,241,232,0.3)", fontSize: "0.75rem", fontWeight: 600, marginBottom: 4 }}>
                {t}
              </div>
              <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
                {t === 0 ? (
                  <div style={{ width: "100%", height: 3, background: "rgba(245,241,232,0.06)", borderRadius: "4px 4px 0 0" }} />
                ) : (
                  segs.map((s, k) => s.n > 0 ? (
                    <div
                      key={s.key}
                      title={`${STATUS_LABEL[s.key as keyof typeof STATUS_LABEL]}: ${s.n}`}
                      style={{
                        width: "100%",
                        height: s.h,
                        background: s.color,
                        borderRadius: k === lastIdx ? "4px 4px 0 0" : "0",
                        transition: "height 0.4s ease",
                      }}
                    />
                  ) : null)
                )}
              </div>
              <span style={{ marginTop: 8, color: "rgba(245,241,232,0.55)", fontSize: "0.7rem", textTransform: "uppercase" }}>{d.label}</span>
            </div>
          );
        })}
      </div>
      {total === 0 && (
        <p style={{ marginTop: 14, textAlign: "center", color: "rgba(245,241,232,0.4)", fontSize: "0.78rem" }}>
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
      <span style={{ color: "rgba(245,241,232,0.55)", fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
        Tasa de conversión
      </span>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "20px 0 16px" }}>
        {/* Donut general */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <svg viewBox="0 0 160 160" style={{ width: "100%", maxWidth: 130, height: "auto" }}>
            <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
            <circle
              cx="80" cy="80" r={r} fill="none"
              stroke="#ba843c" strokeWidth="14"
              strokeDasharray={`${dash} ${c}`} strokeDashoffset={c / 4} strokeLinecap="round"
              transform="rotate(-90 80 80)"
            />
            <text x="80" y="88" textAnchor="middle" fill="#f5f1e8" fontSize="22" fontWeight="600">{pct}%</text>
          </svg>
          <span style={{ marginTop: 6, fontSize: "0.65rem", color: "rgba(245,241,232,0.55)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
            General
          </span>
        </div>

        {/* Donut WhatsApp */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <svg viewBox="0 0 160 160" style={{ width: "100%", maxWidth: 130, height: "auto" }}>
            <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
            <circle
              cx="80" cy="80" r={r} fill="none"
              stroke="#25d366" strokeWidth="14"
              strokeDasharray={`${waDash} ${c}`} strokeDashoffset={c / 4} strokeLinecap="round"
              transform="rotate(-90 80 80)"
            />
            <text x="80" y="88" textAnchor="middle" fill="#f5f1e8" fontSize="22" fontWeight="600">{waPct}%</text>
          </svg>
          <span style={{ marginTop: 6, fontSize: "0.65rem", color: "rgba(245,241,232,0.55)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
            WhatsApp
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.72rem", color: "rgba(245,241,232,0.55)" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#ba843c", fontWeight: 600 }}>General</span>
          <span>Total: <b style={{ color: "#f5f1e8" }}>{conv?.total ?? 0}</b> · OK: <b style={{ color: "#ba843c" }}>{conv?.successful ?? 0}</b> · Canc: <b style={{ color: "#c85050" }}>{conv?.cancelled ?? 0}</b></span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#25d366", fontWeight: 600 }}>WhatsApp</span>
          <span>Conv: <b style={{ color: "#f5f1e8" }}>{wa?.totalConversations ?? 0}</b> · Reservas: <b style={{ color: "#25d366" }}>{wa?.converted ?? 0}</b></span>
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
