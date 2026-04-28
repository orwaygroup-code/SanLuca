"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation, LOCALES, LOCALE_META, type Locale } from "@/lib/i18n";

interface Props {
  isDark: boolean;
}

export function LanguageSwitcher({ isDark }: Props) {
  const { locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const idleColor = isDark ? "rgba(245,241,232,0.6)" : "rgba(30,58,82,0.7)";
  const peru = "#ba843c";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 6px",
          fontFamily: "inherit",
          fontSize: "0.62rem",
          fontWeight: 800,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: open || hovered ? peru : idleColor,
          transition: "color 0.3s",
        }}
      >
        <span>{LOCALE_META[locale].code}</span>
        <span style={{
          fontSize: "0.55rem",
          transition: "transform 0.2s",
          transform: open ? "rotate(180deg)" : "none",
          opacity: 0.7,
        }}>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            minWidth: 160,
            background: isDark ? "rgba(22,30,32,0.98)" : "rgba(255,253,247,0.98)",
            backdropFilter: "blur(12px)",
            border: `1px solid ${isDark ? "rgba(186,132,60,0.3)" : "rgba(30,58,82,0.15)"}`,
            borderRadius: 10,
            padding: "6px",
            boxShadow: "0 10px 32px rgba(0,0,0,0.35)",
            zIndex: 1100,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {LOCALES.map((code) => {
            const isSelected = code === locale;
            const meta = LOCALE_META[code];
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => { setLocale(code as Locale); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "8px 12px",
                  background: isSelected ? "rgba(186,132,60,0.14)" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "0.7rem",
                  letterSpacing: "0.04em",
                  color: isSelected ? peru : isDark ? "rgba(245,241,232,0.85)" : "rgba(30,58,82,0.85)",
                  fontWeight: isSelected ? 700 : 500,
                  transition: "background 0.15s",
                  textAlign: "left",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = isDark ? "rgba(186,132,60,0.07)" : "rgba(30,58,82,0.05)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.18em", color: peru }}>
                  {meta.code}
                </span>
                <span style={{ flex: 1, marginLeft: 4 }}>{meta.native}</span>
                {isSelected && <span style={{ fontSize: "0.55rem", color: peru }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
