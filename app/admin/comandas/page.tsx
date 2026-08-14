"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-client";
import { formatMXN } from "@/lib/displayTotals";

type AuditKind =
  | "PRINT" | "REPRINT" | "TABLE_CHANGE" | "WAITER_CHANGE" | "ITEM_CANCEL" | "ITEM_REMOVE"
  | "PAYMENT" | "PAYMENT_VOID" | "DISCOUNT" | "MERGE" | "TRANSFER" | "REOPEN";
interface AuditEvent { kind: AuditKind; at: string; actor: string; detail: string; reason: string | null }
interface AuditComanda {
  id: number; folio: string; status: string; total: number; table: string; waiter: string; guests: number;
  openedAt: string; closedAt: string | null;
  cancellation: { by: string; reason: string | null; at: string | null } | null;
  events: AuditEvent[];
}

const RANGES = [{ key: "today", label: "Hoy" }, { key: "7d", label: "7 días" }, { key: "30d", label: "30 días" }];

const STATUS_LABEL: Record<string, string> = { OPEN: "Abierta", IN_SERVICE: "En servicio", AWAITING_PAYMENT: "Por cobrar", PAID: "Pagada", CANCELLED: "Cancelada" };
const STATUS_COLOR: Record<string, string> = { OPEN: "#4a82c4", IN_SERVICE: "#3f9d6f", AWAITING_PAYMENT: "#d8a13a", PAID: "rgba(245,241,232,0.5)", CANCELLED: "#d9534f" };
const EVENT_META: Record<string, { label: string; color: string }> = {
  PRINT: { label: "Impresión", color: "#4a82c4" },
  REPRINT: { label: "Reimpresión", color: "#d8a13a" },
  TABLE_CHANGE: { label: "Cambio de mesa", color: "#b07cd6" },
  WAITER_CHANGE: { label: "Cambio de mesero", color: "#b07cd6" },
  ITEM_CANCEL: { label: "Item cancelado", color: "#d9534f" },
  ITEM_REMOVE: { label: "Producto quitado", color: "#d8a13a" },
  PAYMENT: { label: "Cobro", color: "#3f9d6f" },
  PAYMENT_VOID: { label: "Pago anulado", color: "#d9534f" },
  DISCOUNT: { label: "Descuento", color: "#d8a13a" },
  MERGE: { label: "Cuentas juntadas", color: "#b07cd6" },
  TRANSFER: { label: "Traspaso", color: "#4a82c4" },
  REOPEN: { label: "Reapertura", color: "#e0794a" },
};
const eventMeta = (kind: string) => EVENT_META[kind] ?? { label: kind, color: "rgba(245,241,232,0.6)" };

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
}

/** /admin/comandas — auditoría de comandas (impresiones, cambios, cancelaciones). ADMIN. */
export default function AdminComandasAuditPage() {
  const router = useRouter();
  const session = useSession();
  const [range, setRange] = useState("today");
  const [rows, setRows] = useState<AuditComanda[] | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  useEffect(() => {
    if (session.loading) return;
    if (!session.user || session.user.role !== "ADMIN") router.replace("/login?mode=login");
  }, [session.loading, session.user, router]);

  const load = useCallback(async () => {
    setRows(null);
    const r = await fetch(`/api/admin/comandas?range=${range}`, { credentials: "same-origin" });
    const d = await r.json().catch(() => null);
    setRows(d?.success ? (d.data as AuditComanda[]) : []);
  }, [range]);

  useEffect(() => { if (session.user?.role === "ADMIN") load(); }, [session.user, load]);

  if (session.loading || !session.user || session.user.role !== "ADMIN") {
    return <div style={S.page}><div style={{ padding: 40, color: C.dim }}>Cargando…</div></div>;
  }

  const logout = async () => { await session.logout(); router.replace("/login?mode=login"); };
  const visible = (rows ?? []).filter((c) => !onlyFlagged || c.events.length > 0 || c.status === "CANCELLED");

  return (
    <div style={S.page}>
      <main style={S.main}>
        <div style={S.headRow}>
          <h1 style={S.h1}>Auditoría de comandas</h1>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", color: C.dim, fontSize: "0.78rem", marginRight: 6 }}>
              <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
              Solo con eventos
            </label>
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)} style={{ ...S.rangeBtn, ...(range === r.key ? S.rangeOn : {}) }}>{r.label}</button>
            ))}
          </div>
        </div>

        {rows === null ? (
          <div style={{ padding: 40, color: C.dim }}>Cargando…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 40, color: C.faint, textAlign: "center", border: `1px dashed ${C.line}`, borderRadius: 14 }}>Sin comandas en este rango.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visible.map((c) => (
              <div key={c.id} style={S.card}>
                <div style={S.cardHead}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ color: C.gold, fontWeight: 800, fontSize: "0.82rem" }}>{c.folio}</span>
                    <span style={{ color: C.dim, fontSize: "0.82rem", marginLeft: 10 }}>{c.table} · {c.waiter} · {c.guests} pers</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ color: C.cream, fontWeight: 700 }}>{formatMXN(c.total)}</span>
                    <span style={{ ...S.badge, background: STATUS_COLOR[c.status] ?? C.dim }}>{STATUS_LABEL[c.status] ?? c.status}</span>
                  </div>
                </div>

                <div style={{ color: C.faint, fontSize: "0.72rem", marginTop: 4 }}>
                  Abierta {fmt(c.openedAt)}{c.closedAt ? ` · Cerrada ${fmt(c.closedAt)}` : ""}
                </div>

                {c.cancellation && (
                  <div style={S.cancelBox}>
                    Cancelada por {c.cancellation.by}{c.cancellation.reason ? ` — “${c.cancellation.reason}”` : ""}
                  </div>
                )}

                {c.events.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {c.events.map((e, i) => {
                      const m = eventMeta(e.kind);
                      return (
                        <div key={i} style={S.event}>
                          <span style={{ ...S.eventTag, color: m.color, borderColor: m.color }}>{m.label}</span>
                          <span style={{ color: C.cream, fontSize: "0.8rem", flex: 1, minWidth: 0 }}>
                            {e.detail} · <span style={{ color: C.dim }}>{e.actor}</span>
                            {e.reason && <span style={{ color: C.faint }}> — “{e.reason}”</span>}
                          </span>
                          <span style={{ color: C.faint, fontSize: "0.7rem", whiteSpace: "nowrap" }}>{fmt(e.at)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const C = { bg: "#16201f", panel: "#1a2628", gold: "#ba843c", cream: "#f5f1e8", dim: "rgba(245,241,232,0.6)", faint: "rgba(245,241,232,0.42)", border: "rgba(186,132,60,0.22)", line: "rgba(255,255,255,0.08)" };

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: C.bg },
  main: { padding: "22px", maxWidth: 1000, margin: "0 auto" },
  headRow: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 },
  h1: { margin: 0, color: C.cream, fontSize: "1.4rem", fontWeight: 800 },
  rangeBtn: { padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" },
  rangeOn: { background: C.panel, color: C.cream, borderColor: C.border },
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  badge: { padding: "2px 9px", borderRadius: 999, fontSize: "0.66rem", fontWeight: 700, color: "#fff" },
  cancelBox: { marginTop: 8, padding: "8px 11px", borderRadius: 8, background: "rgba(217,83,79,0.12)", border: "1px solid rgba(217,83,79,0.4)", color: "#e9a3a0", fontSize: "0.8rem" },
  event: { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: `1px solid ${C.line}` },
  eventTag: { fontSize: "0.66rem", fontWeight: 700, padding: "2px 8px", borderRadius: 6, border: "1px solid", whiteSpace: "nowrap" },
};
