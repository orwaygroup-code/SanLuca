"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { C, btn, fld, formatMXN, Spinner, EmptyState } from "./ui";
import { apiFetch, type TipsCurrent, type TipArea } from "./types";

/**
 * Reparto de propinas / "puntos" del turno abierto. Las propinas van APARTE de
 * la caja. Por mesero: ventas + propina registrada + efectivo declarado (input)
 * − descuento (punto% × venta) = neto (puede ser negativo). El pool se reparte a
 * áreas editables (% sobre venta; su suma = el punto). Todo se recalcula en el
 * servidor al guardar. Estilo Operate (oscuro/dorado, táctil, AA).
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (s: string | number) => { const n = Number(s); return Number.isFinite(n) ? n : 0; };

export function TipsPanel({ onToast }: { onToast: (m: string, kind?: "success" | "error" | "info") => void }) {
  const [data, setData] = useState<TipsCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<TipArea[]>([]);
  const [declared, setDeclared] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch<TipsCurrent>("/api/caja/tips/current");
    setLoading(false);
    if (!r.ok) { onToast(r.error ?? "No se pudo cargar el reparto", "error"); return; }
    const d = r.data!;
    setData(d);
    // Semilla: áreas del reparto guardado, o política default.
    if (d.saved?.areas?.length) setAreas(d.saved.areas.map((ar) => ({ name: ar.name, percent: num(ar.percent) })));
    else setAreas((d.defaultAreas ?? []).map((ar) => ({ name: ar.name, percent: num(ar.percent) })));
    // Semilla: efectivo declarado del reparto guardado.
    const dec: Record<number, string> = {};
    if (d.saved?.waiters) for (const w of d.saved.waiters) if (num(w.cashTipsDeclared) > 0) dec[w.waiterId] = String(num(w.cashTipsDeclared));
    setDeclared(dec);
  }, [onToast]);

  useEffect(() => { load(); }, [load]);

  const base = data?.base ?? [];
  const pointPercent = useMemo(() => round2(areas.reduce((s, a) => s + num(a.percent), 0)), [areas]);

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
  const areaAmounts = areas.map((a) => ({ ...a, amount: round2((salesTotal * num(a.percent)) / 100) }));

  const setArea = (i: number, patch: Partial<TipArea>) => setAreas((as) => as.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const addArea = () => setAreas((as) => [...as, { name: "", percent: 0 }]);
  const removeArea = (i: number) => setAreas((as) => as.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!data?.session) return;
    setBusy(true);
    const r = await apiFetch<unknown>("/api/caja/tips/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cashSessionId: data.session.id,
        areas: areas.filter((a) => a.name.trim()),
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

      {/* Áreas de reparto (editable) */}
      <div style={s.card}>
        <div style={s.head}>
          <span>Reparto a áreas</span>
          <span style={{ color: C.gold }}>Punto total: {pointPercent}%</span>
        </div>
        {areas.map((a, i) => (
          <div key={i} style={s.areaRow}>
            <input style={{ ...fld.input, flex: 2, minHeight: 40 }} value={a.name} onChange={(e) => setArea(i, { name: e.target.value })} placeholder="Área" />
            <input style={{ ...fld.input, width: 78, minHeight: 40, textAlign: "right" }} value={String(a.percent)} onChange={(e) => setArea(i, { percent: num(e.target.value.replace(/[^\d.]/g, "")) })} inputMode="decimal" />
            <span style={{ color: C.faint, fontSize: "0.78rem" }}>%</span>
            <span style={{ color: C.cream, fontWeight: 700, minWidth: 84, textAlign: "right" }}>{formatMXN(areaAmounts[i]?.amount ?? 0)}</span>
            <button style={s.rm} onClick={() => removeArea(i)} aria-label="Quitar área">×</button>
          </div>
        ))}
        <button style={{ ...btn.ghost, marginTop: 10, minHeight: 40 }} onClick={addArea}>+ Agregar área</button>
        <div style={{ ...s.kv, marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 8, color: C.cream, fontWeight: 800 }}>
          <span>Pool a repartir</span><span>{formatMXN(poolTotal)}</span>
        </div>
      </div>

      {/* Meseros */}
      <div style={s.card}>
        <div style={s.head}><span>Por mesero</span><span style={{ color: C.faint }}>venta del turno</span></div>
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

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
        <button style={btn.ghost} onClick={load} disabled={busy}>↻ Actualizar ventas</button>
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
  areaRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  rm: { width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.red}`, background: "transparent", color: C.red, fontSize: "1.1rem", cursor: "pointer", lineHeight: 1, flexShrink: 0 },
  waiter: { padding: "10px 0", borderBottom: `1px solid ${C.line}` },
  kv: { display: "flex", justifyContent: "space-between", fontSize: "0.86rem" },
};
