"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { C, btn } from "./ui";

/**
 * Tour guiado estilo "tutorial de videojuego": una caja de diálogo abajo + un
 * reflector (spotlight) sobre el elemento resaltado. Cada paso apunta a un
 * elemento con `data-tour="<id>"`; si no está en pantalla, el paso se muestra
 * centrado (sigue enseñando). Avanza con "Siguiente". Sin dependencias externas;
 * respeta el sistema oscuro/dorado y prefers-reduced-motion (CSS global).
 */

export interface TourStep {
  target?: string; // data-tour del elemento a resaltar (omitir = paso centrado)
  title: string;
  body: string;
  task?: string; // reto "¡Tu turno!" para que el usuario pruebe la función
}

export function Tour({ steps, open, onClose }: {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const step = steps[i];

  const measure = useCallback(() => {
    const t = steps[i]?.target;
    if (!t) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${t}"]`) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [steps, i]);

  useEffect(() => { if (open) setI(0); }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = steps[i]?.target ? (document.querySelector(`[data-tour="${steps[i].target}"]`) as HTMLElement | null) : null;
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    // medir tras el scroll suave
    const id = window.setTimeout(measure, 260);
    measure();
    return () => window.clearTimeout(id);
  }, [open, i, measure, steps]);

  useEffect(() => {
    if (!open) return;
    const on = () => measure();
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("scroll", on, true); };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "Enter") setI((n) => Math.min(steps.length - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, steps.length, onClose]);

  if (!open || !step) return null;

  const last = i === steps.length - 1;
  const next = () => (last ? onClose() : setI(i + 1));
  const prev = () => setI(Math.max(0, i - 1));
  const pad = 8;

  return (
    <>
      <style>{`@keyframes slTourPulse { 0%,100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.74), 0 0 0 2px ${C.gold}; } 50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.74), 0 0 0 6px ${C.gold}; } }`}</style>

      {/* Reflector: sobre el objetivo, o dim total si no hay objetivo */}
      {rect ? (
        <div
          aria-hidden
          style={{
            position: "fixed", top: rect.top - pad, left: rect.left - pad,
            width: rect.width + pad * 2, height: rect.height + pad * 2,
            borderRadius: 12, boxShadow: `0 0 0 9999px rgba(0,0,0,0.74), 0 0 0 2px ${C.gold}`,
            animation: "slTourPulse 1.8s ease-in-out infinite", pointerEvents: "none", zIndex: 200,
            transition: "top .25s ease, left .25s ease, width .25s ease, height .25s ease",
          }}
        />
      ) : (
        <div aria-hidden style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.74)", zIndex: 200 }} />
      )}

      {/* Caja de diálogo (abajo, tipo videojuego) */}
      <div role="dialog" aria-label="Tutorial" style={box.card}>
        <div style={box.top}>
          <span style={box.badge}>Tutorial · {i + 1}/{steps.length}</span>
          <button style={box.skip} onClick={onClose}>Saltar</button>
        </div>
        <div style={box.title}>{step.title}</div>
        <p style={box.body}>{step.body}</p>
        {step.task && (
          <div style={box.task}><span style={box.taskTag}>¡Tu turno!</span> {step.task}</div>
        )}
        <div style={box.dots}>
          {steps.map((_, idx) => (
            <span key={idx} style={{ ...box.dot, ...(idx === i ? box.dotOn : {}), ...(idx < i ? box.dotDone : {}) }} />
          ))}
        </div>
        <div style={box.actions}>
          <button style={{ ...btn.ghost, opacity: i === 0 ? 0.4 : 1 }} onClick={prev} disabled={i === 0}>Atrás</button>
          <button style={{ ...btn.primary, flex: 1 }} onClick={next}>{last ? "¡Listo!" : "Siguiente"}</button>
        </div>
      </div>
    </>
  );
}

const box: Record<string, React.CSSProperties> = {
  card: {
    position: "fixed", left: "50%", bottom: "max(16px, env(safe-area-inset-bottom))", transform: "translateX(-50%)",
    width: "min(460px, calc(100vw - 24px))", zIndex: 201,
    background: C.panel, border: `1px solid ${C.gold}`, borderRadius: 18,
    padding: "16px 18px 18px", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
  },
  top: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  badge: {
    fontFamily: "inherit", fontSize: "0.64rem", letterSpacing: "0.16em", textTransform: "uppercase",
    fontWeight: 800, color: C.gold,
  },
  skip: { background: "transparent", border: "none", color: C.faint, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", padding: 4 },
  title: { color: C.cream, fontWeight: 800, fontSize: "1.12rem", lineHeight: 1.2 },
  body: { color: C.dim, fontSize: "0.9rem", lineHeight: 1.55, margin: "6px 0 0" },
  task: {
    marginTop: 12, padding: "10px 12px", borderRadius: 10,
    background: "color-mix(in srgb, #ba843c 12%, transparent)", border: `1px solid ${C.border}`,
    color: C.cream, fontSize: "0.86rem", lineHeight: 1.45,
  },
  taskTag: { color: C.gold, fontWeight: 800, marginRight: 4 },
  dots: { display: "flex", gap: 6, justifyContent: "center", margin: "14px 0 12px" },
  dot: { width: 7, height: 7, borderRadius: 999, background: "rgba(245,241,232,0.22)" },
  dotOn: { background: C.gold, transform: "scale(1.25)" },
  dotDone: { background: "rgba(186,132,60,0.5)" },
  actions: { display: "flex", gap: 10 },
};
