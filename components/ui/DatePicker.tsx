"use client";
import { useState, useRef, useEffect } from "react";

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_ES   = ["Lu","Ma","Mi","Ju","Vi","Sá","Do"];

interface DatePickerProps {
  value: string;            // "YYYY-MM-DD"
  onChange: (v: string) => void;
  min?: string;             // "YYYY-MM-DD" — días anteriores deshabilitados
  disabledDow?: number[];   // día de semana deshabilitado: 0=Dom,1=Lun…
  placeholder?: string;
  style?: React.CSSProperties;
}

export function DatePicker({ value, onChange, min, disabledDow = [], placeholder = "Selecciona fecha", style }: DatePickerProps) {
  const today    = new Date();
  const initD    = value ? new Date(value + "T12:00:00") : today;
  const [open, setOpen]       = useState(false);
  const [viewY, setViewY]     = useState(initD.getFullYear());
  const [viewM, setViewM]     = useState(initD.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (value) {
      const d = new Date(value + "T12:00:00");
      setViewY(d.getFullYear());
      setViewM(d.getMonth());
    }
  }, [value]);

  const minDate = min
    ? new Date(min + "T00:00:00")
    : new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const display = value
    ? new Date(value + "T12:00:00").toLocaleDateString("es-MX", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : null;

  // Calendar grid (Mon-first)
  const firstDow = new Date(viewY, viewM, 1).getDay(); // 0=Sun
  const leadBlanks = (firstDow + 6) % 7;               // shift to Mon=0
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(leadBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function fmt(d: number) {
    return `${viewY}-${String(viewM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function isDisabled(d: number) {
    const date = new Date(viewY, viewM, d);
    if (date < minDate) return true;
    if (disabledDow.includes(date.getDay())) return true;
    return false;
  }

  function prevMonth() {
    if (viewM === 0) { setViewM(11); setViewY((y) => y - 1); }
    else setViewM((m) => m - 1);
  }
  function nextMonth() {
    if (viewM === 11) { setViewM(0); setViewY((y) => y + 1); }
    else setViewM((m) => m + 1);
  }

  return (
    <div ref={ref} style={{ position: "relative", ...style }}>

      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "10px 14px",
          background: open ? "rgba(186,132,60,0.1)" : "rgba(186,132,60,0.06)",
          border: `1px solid ${open ? "#ba843c" : "rgba(186,132,60,0.3)"}`,
          borderRadius: 8,
          color: display ? "#f5f1e8" : "rgba(245,241,232,0.35)",
          fontSize: "0.83rem",
          fontFamily: "inherit",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          transition: "all 0.18s",
          textTransform: display ? "capitalize" : "none",
          letterSpacing: "0.01em",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {display ?? placeholder}
        </span>
        <span style={{ fontSize: "0.75rem", color: "#ba843c", flexShrink: 0, transition: "transform 0.18s", transform: open ? "rotate(180deg)" : "none" }}>
          ▾
        </span>
      </button>

      {/* ── Calendar panel ── */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          background: "#161e20",
          border: "1px solid rgba(186,132,60,0.4)",
          borderRadius: 12,
          zIndex: 9999,
          padding: "14px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.65)",
          minWidth: 272,
        }}>

          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button type="button" onClick={prevMonth}
              style={{ background: "none", border: "1px solid rgba(186,132,60,0.25)", borderRadius: 6, color: "#ba843c", width: 28, height: 28, cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
              ‹
            </button>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f5f1e8", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {MONTHS_ES[viewM]} {viewY}
            </span>
            <button type="button" onClick={nextMonth}
              style={{ background: "none", border: "1px solid rgba(186,132,60,0.25)", borderRadius: 6, color: "#ba843c", width: 28, height: 28, cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
              ›
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {DAYS_ES.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: "0.58rem", color: "rgba(186,132,60,0.55)", fontWeight: 700, letterSpacing: "0.06em", padding: "2px 0" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {cells.map((d, i) => {
              if (d === null) return <div key={`_${i}`} />;
              const sel = value === fmt(d);
              const dis = isDisabled(d);
              const isT = viewY === today.getFullYear() && viewM === today.getMonth() && d === today.getDate();
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => { if (!dis) { onChange(fmt(d)); setOpen(false); } }}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 6,
                    border: isT && !sel ? "1px solid rgba(186,132,60,0.45)" : "1px solid transparent",
                    background: sel ? "#ba843c" : "transparent",
                    color: dis ? "rgba(245,241,232,0.15)" : sel ? "#fff" : isT ? "#ba843c" : "rgba(245,241,232,0.72)",
                    fontSize: "0.78rem",
                    fontWeight: sel ? 700 : 400,
                    cursor: dis ? "not-allowed" : "pointer",
                    transition: "all 0.1s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                  onMouseEnter={(e) => { if (!dis && !sel) e.currentTarget.style.background = "rgba(186,132,60,0.15)"; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
