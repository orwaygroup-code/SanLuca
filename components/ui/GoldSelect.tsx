"use client";
import { useState, useRef, useEffect } from "react";

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

interface GoldSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function GoldSelect({ value, onChange, options, placeholder = "Selecciona", disabled, style }: GoldSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const selected = options.find((o) => o.value === value);

  // Group options preserving insertion order
  const groups: { name: string; opts: SelectOption[] }[] = [];
  const seenGroups = new Map<string, SelectOption[]>();
  for (const opt of options) {
    const g = opt.group ?? "";
    if (!seenGroups.has(g)) {
      const arr: SelectOption[] = [];
      seenGroups.set(g, arr);
      groups.push({ name: g, opts: arr });
    }
    seenGroups.get(g)!.push(opt);
  }

  return (
    <div ref={ref} style={{ position: "relative", ...style }}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "10px 14px",
          background: disabled ? "rgba(255,255,255,0.03)" : open ? "rgba(186,132,60,0.1)" : "rgba(186,132,60,0.06)",
          border: `1px solid ${open ? "#ba843c" : disabled ? "rgba(255,255,255,0.08)" : "rgba(186,132,60,0.3)"}`,
          borderRadius: 8,
          color: disabled ? "rgba(245,241,232,0.2)" : selected ? "#f5f1e8" : "rgba(245,241,232,0.35)",
          fontSize: "0.85rem",
          fontFamily: "inherit",
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          transition: "all 0.18s",
          letterSpacing: "0.01em",
        }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <span style={{
          fontSize: "0.65rem",
          color: disabled ? "rgba(186,132,60,0.25)" : "#ba843c",
          transition: "transform 0.18s",
          transform: open ? "rotate(180deg)" : "none",
          flexShrink: 0,
        }}>▾</span>
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          right: 0,
          background: "#161e20",
          border: "1px solid rgba(186,132,60,0.4)",
          borderRadius: 10,
          zIndex: 9999,
          maxHeight: 268,
          overflowY: "auto",
          boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
        }}>
          {groups.map(({ name, opts }) => (
            <div key={name}>
              {name && (
                <div style={{
                  padding: "8px 14px 5px",
                  fontSize: "0.58rem",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "#ba843c",
                  fontWeight: 700,
                  opacity: 0.85,
                  borderBottom: "1px solid rgba(186,132,60,0.12)",
                  marginBottom: 2,
                }}>
                  {name}
                </div>
              )}
              {opts.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    style={{
                      width: "100%",
                      padding: "9px 14px",
                      background: isSelected ? "rgba(186,132,60,0.14)" : "transparent",
                      border: "none",
                      color: isSelected ? "#ba843c" : "rgba(245,241,232,0.7)",
                      fontSize: "0.85rem",
                      fontFamily: "inherit",
                      textAlign: "left",
                      cursor: "pointer",
                      fontWeight: isSelected ? 700 : 400,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(186,132,60,0.07)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? "rgba(186,132,60,0.14)" : "transparent"; }}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <span style={{ fontSize: "0.6rem", color: "#ba843c", flexShrink: 0 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
