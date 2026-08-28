"use client";

import { useEffect, useState } from "react";

// Diálogo global con estilo de la app para reemplazar alert()/confirm()/prompt() nativos.
// Uso: await dialogAlert("msg") / await dialogConfirm("msg") / await dialogPrompt("msg").
// Requiere <DialogHost/> montado una vez (en el layout raíz).

type Kind = "alert" | "confirm" | "prompt";
interface Req {
  kind: Kind; message: string; title?: string;
  placeholder?: string; defaultValue?: string; danger?: boolean; confirmLabel?: string;
  resolve: (v: unknown) => void;
}

let controller: ((req: Req) => void) | null = null;

function open(req: Omit<Req, "resolve">): Promise<unknown> {
  return new Promise((resolve) => {
    if (!controller) {
      // Fallback nativo si el host aún no está montado.
      if (typeof window === "undefined") { resolve(req.kind === "confirm" ? false : req.kind === "prompt" ? null : undefined); return; }
      if (req.kind === "alert") { window.alert(req.message); resolve(undefined); }
      else if (req.kind === "confirm") resolve(window.confirm(req.message));
      else resolve(window.prompt(req.message, req.defaultValue ?? ""));
      return;
    }
    controller({ ...req, resolve });
  });
}

export function dialogAlert(message: string, title?: string): Promise<void> {
  return open({ kind: "alert", message, title }) as Promise<void>;
}
export function dialogConfirm(message: string, opts?: { title?: string; danger?: boolean; confirmLabel?: string }): Promise<boolean> {
  return open({ kind: "confirm", message, ...opts }) as Promise<boolean>;
}
export function dialogPrompt(message: string, opts?: { title?: string; placeholder?: string; defaultValue?: string; confirmLabel?: string }): Promise<string | null> {
  return open({ kind: "prompt", message, ...opts }) as Promise<string | null>;
}

const C = { bg: "#16201f", panel: "#1a2628", gold: "#ba843c", cream: "#f5f1e8", dim: "rgba(245,241,232,0.62)", border: "rgba(186,132,60,0.3)", line: "rgba(255,255,255,0.08)", red: "#e0574f" };

export function DialogHost() {
  const [req, setReq] = useState<Req | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    controller = (r) => { setReq(r); setValue(r.defaultValue ?? ""); };
    return () => { controller = null; };
  }, []);

  if (!req) return null;

  const done = (result: unknown) => { req.resolve(result); setReq(null); setValue(""); };
  const onCancel = () => done(req.kind === "confirm" ? false : req.kind === "prompt" ? null : undefined);
  const onOk = () => done(req.kind === "prompt" ? value : req.kind === "confirm" ? true : undefined);

  const btn = (primary: boolean): React.CSSProperties => ({
    padding: "11px 18px", borderRadius: 10, border: primary ? "none" : `1px solid ${C.border}`,
    background: primary ? (req.danger ? C.red : C.gold) : "transparent", color: primary ? "#16201f" : C.dim,
    fontWeight: 800, fontSize: "0.86rem", cursor: "pointer", fontFamily: "inherit",
  });

  return (
    <div onMouseDown={onCancel} style={{ position: "fixed", inset: 0, zIndex: 2147483640, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)", padding: 20 }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: "min(94vw, 420px)", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: "22px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.55)" }}>
        {req.title && <div style={{ color: C.cream, fontWeight: 800, fontSize: "1rem", marginBottom: 8 }}>{req.title}</div>}
        <div style={{ color: req.title ? C.dim : C.cream, fontSize: "0.92rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{req.message}</div>

        {req.kind === "prompt" && (
          <input
            autoFocus value={value} placeholder={req.placeholder ?? ""}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onOk(); else if (e.key === "Escape") onCancel(); }}
            style={{ width: "100%", marginTop: 14, padding: "11px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.cream, fontSize: "0.92rem", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          {req.kind !== "alert" && <button onMouseDown={(e) => e.stopPropagation()} onClick={onCancel} style={btn(false)}>Cancelar</button>}
          <button onMouseDown={(e) => e.stopPropagation()} onClick={onOk} autoFocus={req.kind !== "prompt"} style={btn(true)}>{req.confirmLabel ?? (req.kind === "alert" ? "Entendido" : "Aceptar")}</button>
        </div>
      </div>
    </div>
  );
}
