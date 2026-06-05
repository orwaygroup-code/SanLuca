"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { buildTotalLines, formatMXN, type ComandaMoney } from "@/lib/displayTotals";

/**
 * Primitivos de UI compartidos por las vistas de Staff (Fase B.2):
 * paleta, StaffHeader, sistema de toasts, modales (confirm / razón),
 * TicketPreview. Todo inline-style, sin dependencias externas.
 */

export const C = {
  bg: "#16201f",
  panel: "#1a2628",
  panel2: "#1f2d2c",
  gold: "#ba843c",
  cream: "#f5f1e8",
  dim: "rgba(245,241,232,0.55)",
  faint: "rgba(245,241,232,0.35)",
  border: "rgba(186,132,60,0.22)",
  line: "rgba(255,255,255,0.08)",
  green: "#3f9d6f",
  red: "#d9534f",
  blue: "#4a82c4",
  amber: "#d8a13a",
};

export const ROLE_LABEL: Record<string, string> = {
  WAITER: "Mesero",
  OPERATION: "Operación",
  CAPTAIN: "Capitán",
  MANAGER: "Manager",
  ADMIN: "Administrador",
};

export const STATUS_LABEL: Record<string, string> = {
  OPEN: "Abierta",
  IN_SERVICE: "En servicio",
  AWAITING_PAYMENT: "Por cobrar",
  PAID: "Pagada",
  CANCELLED: "Cancelada",
  FREE: "Libre",
};

export const STATUS_COLOR: Record<string, string> = {
  OPEN: C.blue,
  IN_SERVICE: C.green,
  AWAITING_PAYMENT: C.amber,
  PAID: C.dim,
  CANCELLED: C.red,
  FREE: "rgba(255,255,255,0.18)",
};

// ─────────────────────────────────────────────────────────── StaffHeader ──
export function StaffHeader(props: {
  title: string;
  role?: string;
  userName?: string;
  onLogout?: () => void;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header style={hS.bar}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {props.onBack && (
          <button style={hS.back} onClick={props.onBack} aria-label="Volver">←</button>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={hS.brand}>SAN LUCA</div>
          <div style={hS.title}>{props.title}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {props.right}
        {props.userName && (
          <div style={{ textAlign: "right", lineHeight: 1.2 }}>
            <div style={{ color: C.cream, fontSize: "0.82rem", fontWeight: 600 }}>{props.userName}</div>
            {props.role && <div style={{ color: C.faint, fontSize: "0.66rem" }}>{ROLE_LABEL[props.role] ?? props.role}</div>}
          </div>
        )}
        {props.onLogout && (
          <button style={hS.logout} onClick={props.onLogout}>Salir</button>
        )}
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────── Toasts ──
export type ToastKind = "success" | "error" | "info";
export interface Toast { id: number; message: string; kind: ToastKind }

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [seq, setSeq] = useState(1);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((message: string, kind: ToastKind = "info") => {
    setSeq((n) => {
      const id = n;
      setToasts((t) => [...t, { id, message, kind }]);
      // auto-dismiss
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 5000 : 3000);
      return n + 1;
    });
  }, []);
  return { toasts, push, dismiss };
}

export function ToastHost({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  const color = { success: C.green, error: C.red, info: C.blue };
  return (
    <div style={tS.host}>
      {toasts.map((t) => (
        <div key={t.id} style={{ ...tS.toast, borderLeft: `4px solid ${color[t.kind]}` }} onClick={() => onClose(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────── Modal ──
export function Modal({ open, title, onClose, children, width = 420 }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode; width?: number;
}) {
  if (!open) return null;
  return (
    <div style={mS.overlay} onClick={onClose}>
      <div style={{ ...mS.box, maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div style={mS.head}>
          <span style={mS.title}>{title}</span>
          <button style={mS.x} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={{ padding: "16px 20px 20px" }}>{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({ open, title, message, confirmLabel = "Confirmar", danger, busy, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmLabel?: string;
  danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p style={{ margin: "0 0 18px", color: C.dim, fontSize: "0.9rem", lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button style={btn.ghost} onClick={onCancel} disabled={busy}>Cancelar</button>
        <button style={{ ...(danger ? btn.danger : btn.primary), opacity: busy ? 0.6 : 1 }} onClick={onConfirm} disabled={busy}>
          {busy ? "…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function ReasonModal({ open, title, label = "Motivo", confirmLabel = "Confirmar", danger, busy, onConfirm, onCancel }: {
  open: boolean; title: string; label?: string; confirmLabel?: string;
  danger?: boolean; busy?: boolean; onConfirm: (reason: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal open={open} title={title} onClose={() => { setReason(""); onCancel(); }}>
      <label style={fld.label}>{label}</label>
      <textarea
        style={{ ...fld.input, minHeight: 72, resize: "vertical" }}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Escribe el motivo (queda en la auditoría)…"
        autoFocus
      />
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button style={btn.ghost} onClick={() => { setReason(""); onCancel(); }} disabled={busy}>Cancelar</button>
        <button
          style={{ ...(danger ? btn.danger : btn.primary), opacity: !reason.trim() || busy ? 0.5 : 1 }}
          onClick={() => onConfirm(reason.trim())}
          disabled={!reason.trim() || busy}
        >
          {busy ? "…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────── TicketPreview ──
export interface TicketSplit {
  title: string;
  items: { name: string; qty: number; total: number }[];
  money: ComandaMoney;
}

export function TicketPreview({ folio, table, money, taxEnabled, items, splits, footer }: {
  folio: string; table?: string; money: ComandaMoney; taxEnabled: boolean;
  items?: { name: string; qty: number; total: number }[];
  splits?: TicketSplit[];
  footer?: React.ReactNode;
}) {
  const lines = buildTotalLines(money, taxEnabled);
  const hasSplits = !!splits && splits.length > 0;
  return (
    <div style={tk.paper}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 800, letterSpacing: "0.2em", fontSize: "0.8rem" }}>SAN LUCA</div>
        <div style={{ fontSize: "0.7rem", color: "#555" }}>{folio}{table ? ` · ${table}` : ""}</div>
      </div>

      {hasSplits ? (
        <>
          {splits!.map((sp, si) => {
            const spLines = buildTotalLines(sp.money, taxEnabled);
            return (
              <div key={si} style={{ borderTop: "1px dashed #aaa", padding: "6px 0", margin: "4px 0" }}>
                <div style={{ fontWeight: 800, fontSize: "0.74rem", letterSpacing: "0.08em", marginBottom: 4 }}>
                  {sp.title.toUpperCase()}
                </div>
                {sp.items.map((it, i) => (
                  <div key={i} style={tk.row}>
                    <span>{it.qty}× {it.name}</span>
                    <span>{formatMXN(it.total)}</span>
                  </div>
                ))}
                {spLines.map((l) => (
                  <div key={l.label} style={{ ...tk.row, fontWeight: l.strong ? 700 : 400, fontSize: l.strong ? "0.82rem" : "0.74rem" }}>
                    <span>{l.label}</span><span>{formatMXN(l.amount)}</span>
                  </div>
                ))}
              </div>
            );
          })}
          <div style={{ borderTop: "2px solid #333", marginTop: 6, paddingTop: 6 }}>
            <div style={{ ...tk.row, fontWeight: 800, fontSize: "0.95rem" }}>
              <span>TOTAL GENERAL</span><span>{formatMXN(Number(money.total))}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {items && items.length > 0 && (
            <div style={{ borderTop: "1px dashed #aaa", borderBottom: "1px dashed #aaa", padding: "6px 0", margin: "6px 0" }}>
              {items.map((it, i) => (
                <div key={i} style={tk.row}>
                  <span>{it.qty}× {it.name}</span>
                  <span>{formatMXN(it.total)}</span>
                </div>
              ))}
            </div>
          )}
          {lines.map((l) => (
            <div key={l.label} style={{ ...tk.row, fontWeight: l.strong ? 800 : 400, fontSize: l.strong ? "0.95rem" : "0.8rem" }}>
              <span>{l.label}</span>
              <span>{formatMXN(l.amount)}</span>
            </div>
          ))}
        </>
      )}

      {footer && <div style={{ marginTop: 8, textAlign: "center", fontSize: "0.68rem", color: "#555" }}>{footer}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────── misc helpers ──
export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: "0.66rem",
      fontWeight: 700, letterSpacing: "0.04em", color: "#fff", background: color, whiteSpace: "nowrap",
    }}>{text}</span>
  );
}

export function Spinner({ label = "Cargando…" }: { label?: string }) {
  return <div style={{ padding: 40, textAlign: "center", color: C.dim, fontSize: "0.85rem" }}>{label}</div>;
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      padding: "48px 20px", textAlign: "center", color: C.faint, fontSize: "0.9rem",
      border: `1px dashed ${C.line}`, borderRadius: 14, margin: "8px 0",
    }}>{text}</div>
  );
}

/** Logout que limpia la cookie sl_staff y manda al login. */
export function useStaffLogout() {
  const router = useRouter();
  return useCallback(async () => {
    await fetch("/api/auth/staff/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    router.replace("/staff/login");
  }, [router]);
}

export { formatMXN };

// ─────────────────────────────────────────────────────────────── styles ──
const hS: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: "12px 18px", background: C.panel, borderBottom: `1px solid ${C.border}`,
    position: "sticky", top: 0, zIndex: 30,
  },
  brand: { fontSize: "0.56rem", letterSpacing: "0.36em", color: C.gold, fontWeight: 800 },
  title: { fontSize: "1rem", color: C.cream, fontWeight: 700, lineHeight: 1.2 },
  back: {
    width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent",
    color: C.cream, fontSize: "1.1rem", cursor: "pointer",
  },
  logout: {
    padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent",
    color: C.dim, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
  },
};

const tS: Record<string, React.CSSProperties> = {
  host: { position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", zIndex: 100, display: "flex", flexDirection: "column", gap: 8, width: "min(420px, 92vw)" },
  toast: { background: C.panel, color: C.cream, padding: "12px 16px", borderRadius: 10, fontSize: "0.85rem", boxShadow: "0 12px 32px rgba(0,0,0,0.5)", cursor: "pointer" },
};

const mS: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 16 },
  box: { width: "100%", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${C.line}` },
  title: { color: C.cream, fontWeight: 700, fontSize: "0.98rem" },
  x: { background: "transparent", border: "none", color: C.dim, fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 },
};

export const btn: Record<string, React.CSSProperties> = {
  primary: { padding: "10px 18px", borderRadius: 9, border: "none", background: C.gold, color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" },
  ghost: { padding: "10px 18px", borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.dim, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" },
  danger: { padding: "10px 18px", borderRadius: 9, border: "none", background: C.red, color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" },
};

export const fld: Record<string, React.CSSProperties> = {
  label: { display: "block", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint, fontWeight: 700, marginBottom: 6 },
  input: { width: "100%", padding: "11px 13px", borderRadius: 9, boxSizing: "border-box", border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.05)", color: C.cream, fontSize: "0.9rem", fontFamily: "inherit" },
};

const tk: Record<string, React.CSSProperties> = {
  paper: { background: "#fff", color: "#111", borderRadius: 8, padding: "14px 16px", fontFamily: "'Courier New', monospace", fontSize: "0.78rem", maxWidth: 280, margin: "0 auto" },
  row: { display: "flex", justifyContent: "space-between", gap: 12, padding: "2px 0" },
};
