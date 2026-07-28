"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { C, btn, fld, formatMXN, Spinner, EmptyState } from "./ui";
import { apiFetch, type TipsCurrent, type TipArea } from "./types";

/**
 * Reparto de propinas / "puntos" del turno abierto (vista de Caja/Perla).
 * Las propinas van APARTE de la caja. Por mesero: ventas + propina registrada +
 * efectivo declarado (input) − descuento (punto% × venta) = neto (puede ser
 * negativo). El pool se reparte a áreas por peso. El punto% y las áreas los
 * define SOLO el admin en Ajustes: aquí se ven pero NO se editan. Perla solo
 * captura el efectivo declarado y guarda. Recálculo en el servidor.
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (s: string | number) => { const n = Number(s); return Number.isFinite(n) ? n : 0; };

function distribute(pool: number, areas: TipArea[]) {
  const totalW = areas.reduce((s, a) => s + Math.max(0, num(a.percent)), 0);
  return areas.map((a) => ({ ...a, amount: totalW > 0 ? round2((pool * Math.max(0, num(a.percent))) / totalW) : 0 }));
}

export function TipsPanel({ onToast }: { onToast: (m: string, kind?: "success" | "error" | "info") => void }) {
  const [data, setData] = useState<TipsCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [declared, setDeclared] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch<TipsCurrent>("/api/caja/tips/current");
    setLoading(false);
    if (!r.ok) { onToast(r.error ?? "No se pudo cargar el reparto", "error"); return; }
    const d = r.data!;
    setData(d);
    const dec: Record<number, string> = {};
    if (d.saved?.waiters) for (const w of d.saved.waiters) if (num(w.cashTipsDeclared) > 0) dec[w.waiterId] = String(num(w.cashTipsDeclared));
    setDeclared(dec);
  }, [onToast]);

  useEffect(() => { load(); }, [load]);

  const base = data?.base ?? [];
  const pointPercent = num(data?.policy?.pointPercent ?? 0);
  const areas = useMemo(() => data?.policy?.areas ?? [], [data]);

  const rows = useMemo(() => base.map((w) => {
    const sales = num(w.salesTotal);
    const registered = num(w.tipsRegistered);
    const cash = num(declared[w.waiterId] ?? "");
    const deduction = round2((sales * pointPercent) / 100);
    const net = round2(registered + cash - deduction);
    return { ...w, sales, registered, cash, deduction, net };
  }), [base, declared, pointPercent]);

  const salesTotal = round2(rows.reduce((s, r) => s + r.sales, 0));
  const registeredTotal = round2(rows.reduce((s, r) => s + r.registered, 0));
  const cashTotal = round2(rows.reduce((s, r) => s + r.cash, 0));
  const poolTotal = round2(rows.reduce((s, r) => s + r.deduction, 0));
  const apartado = round2(registeredTotal + cashTotal);
  const areaAmounts = distribute(poolTotal, areas);

  const save = async () => {
    if (!data?.session) return;
    setBusy(true);
    const r = await apiFetch<unknown>("/api/caja/tips/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cashSessionId: data.session.id,
        waiters: base.map((w) => ({ waiterId: w.waiterId, cashTipsDeclared: num(declared[w.waiterId] ?? "") })),
      }),
    });
    setBusy(false);
    if (r.ok) { onToast("Reparto guardado", "success"); load(); }
    else onToast(r.error ?? "No se pudo guardar", "error");
  };

  if (loading) return <Spinner label="Cargando reparto…" />;
  if (!data?.session) return <EmptyState text="Abre un turno de caja para hacer el reparto de propinas." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Apartado de propinas (separado de la caja) */}
      <div style={s.apartado}>
        <div>
          <div style={s.apartadoLabel}>Apartado de propinas</div>
          <div style={s.apartadoHint}>Aparte de la caja — no entra ni se resta del efectivo del corte.</div>
        </div>
        <div style={s.apartadoVal}>{formatMXN(apartado)}</div>
      </div>

      {/* Meseros */}
      <div style={s.card}>
        <div style={s.head}><span>Por mesero</span><span style={{ color: C.gold }}>Punto {pointPercent}% sobre venta</span></div>
        {rows.length === 0 ? (
          <div style={{ color: C.faint, fontSize: "0.86rem", padding: "10px 0" }}>Aún no hay ventas cobradas en este turno.</div>
        ) : rows.map((r) => (
          <div key={r.waiterId} style={s.waiter}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <span style={{ color: C.cream, fontWeight: 700 }}>{r.fullName}</span>
              <span style={{ fontWeight: 800, color: r.net < 0 ? C.red : C.green }}>Neto {formatMXN(r.net)}</span>
            </div>
            <div style={{ color: C.faint, fontSize: "0.76rem", marginTop: 4 }}>
              Ventas {formatMXN(r.sales)} · Prop. registrada {formatMXN(r.registered)} · Descuento −{formatMXN(r.deduction)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <label style={{ ...fld.label, marginBottom: 0, flexShrink: 0 }}>Efectivo declarado</label>
              <input
                style={{ ...fld.input, minHeight: 40, maxWidth: 140, textAlign: "right" }}
                value={declared[r.waiterId] ?? ""}
                onChange={(e) => setDeclared((d) => ({ ...d, [r.waiterId]: e.target.value.replace(/[^\d.]/g, "") }))}
                inputMode="decimal"
                placeholder="0.00"
              />
            </div>
          </div>
        ))}
        <div style={{ ...s.kv, marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 8, color: C.dim }}>
          <span>Ventas del turno</span><span>{formatMXN(salesTotal)}</span>
        </div>
      </div>

      {/* Reparto a áreas (solo lectura — lo configura el admin) */}
      <div style={s.card}>
        <div style={s.head}><span>Reparto a áreas</span><span style={{ color: C.faint }}>configurado en Ajustes</span></div>
        {areas.length === 0 ? (
          <div style={{ color: C.faint, fontSize: "0.84rem" }}>Sin áreas configuradas. Pide al administrador definirlas en Ajustes.</div>
        ) : areaAmounts.map((a, i) => (
          <div key={i} style={s.kv}>
            <span style={{ color: C.cream }}>{a.name} <span style={{ color: C.faint, fontSize: "0.76rem" }}>({round2(num(a.percent))})</span></span>
            <span style={{ color: C.cream, fontWeight: 700 }}>{formatMXN(a.amount)}</span>
          </div>
        ))}
        <div style={{ ...s.kv, marginTop: 8, borderTop: `1px solid ${C.line}`, paddingTop: 8, color: C.cream, fontWeight: 800 }}>
          <span>Pool a repartir</span><span>{formatMXN(poolTotal)}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
        <button style={btn.ghost} onClick={load} disabled={busy}>↻ Actualizar</button>
        <button style={{ ...btn.primary, opacity: busy ? 0.6 : 1 }} onClick={save} disabled={busy}>
          {busy ? "Guardando…" : data.saved ? "Actualizar reparto" : "Guardar reparto"}
        </button>
      </div>
      {data.saved && <div style={{ color: C.faint, fontSize: "0.74rem", textAlign: "center" }}>Reparto guardado para este turno · se recalcula al guardar.</div>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  apartado: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
    background: "color-mix(in srgb, #ba843c 10%, #1a2628)", border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px",
  },
  apartadoLabel: { color: C.gold, fontWeight: 800, fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase" },
  apartadoHint: { color: C.faint, fontSize: "0.74rem", marginTop: 3, maxWidth: 300 },
  apartadoVal: { color: C.cream, fontWeight: 800, fontSize: "1.5rem" },
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" },
  head: { display: "flex", justifyContent: "space-between", color: C.faint, fontSize: "0.66rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 },
  waiter: { padding: "10px 0", borderBottom: `1px solid ${C.line}` },
  kv: { display: "flex", justifyContent: "space-between", fontSize: "0.86rem", padding: "3px 0" },
};
