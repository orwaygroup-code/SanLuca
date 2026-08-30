"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-client";
import { ScheduleEditor } from "@/components/admin/ScheduleEditor";

interface TipArea { name: string; percent: number }
interface TipPolicyJson { pointPercent?: number; areas?: TipArea[] }
interface Settings { taxEnabled: boolean; taxRate: number | string; tipPolicy?: TipPolicyJson | null; employeeDiscountPercent?: number | string; updatedAt: string }

const DEFAULT_TIP_AREAS: TipArea[] = [
  { name: "Barra", percent: 2 }, { name: "Cocina", percent: 2.5 },
  { name: "Garroteros", percent: 1 }, { name: "Encargados", percent: 1 }, { name: "Caja", percent: 0.5 },
];

/** /admin/settings — toggle de IVA y tasa. Realm sl_session ADMIN (Ricardo). */
export default function AdminSettingsPage() {
  const router = useRouter();
  const session = useSession();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [ratePct, setRatePct] = useState("16");
  const [empDiscPct, setEmpDiscPct] = useState("50"); // #5 descuento a empleados
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  // Reparto de propinas
  const [pointPct, setPointPct] = useState("7");
  const [areas, setAreas] = useState<TipArea[]>(DEFAULT_TIP_AREAS);
  const [savingTips, setSavingTips] = useState(false);
  const [tipMsg, setTipMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (session.loading) return;
    if (!session.user || session.user.role !== "ADMIN") router.replace("/login?mode=login");
  }, [session.loading, session.user, router]);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/settings", { credentials: "same-origin" });
    const d = await r.json().catch(() => null);
    if (d?.success) {
      const s = d.data as Settings;
      setSettings(s);
      setTaxEnabled(s.taxEnabled);
      setRatePct((Number(s.taxRate) * 100).toFixed(2).replace(/\.00$/, ""));
      setEmpDiscPct(String(s.employeeDiscountPercent ?? 50).replace(/\.00$/, ""));
      const tp = s.tipPolicy;
      setPointPct(String(tp?.pointPercent ?? 7));
      setAreas(Array.isArray(tp?.areas) && tp!.areas!.length
        ? tp!.areas!.map((a) => ({ name: String(a.name ?? ""), percent: Number(a.percent) || 0 }))
        : DEFAULT_TIP_AREAS);
    }
  }, []);

  useEffect(() => { if (session.user?.role === "ADMIN") load(); }, [session.user, load]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const rateNum = Number(ratePct) / 100;
    if (Number.isNaN(rateNum) || rateNum < 0 || rateNum >= 1) {
      setMsg({ kind: "err", text: "Tasa inválida (0 a 99.99%)." });
      setSaving(false);
      return;
    }
    const empNum = Number(empDiscPct);
    if (!Number.isFinite(empNum) || empNum < 0 || empNum > 100) {
      setMsg({ kind: "err", text: "Descuento a empleados inválido (0 a 100%)." });
      setSaving(false);
      return;
    }
    const r = await fetch("/api/admin/settings", {
      method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taxEnabled, taxRate: rateNum, employeeDiscountPercent: empNum }),
    });
    const d = await r.json().catch(() => null);
    setSaving(false);
    if (d?.success) { setMsg({ kind: "ok", text: "Ajustes guardados." }); load(); }
    else setMsg({ kind: "err", text: d?.error ?? "Error al guardar." });
  };

  const setArea = (i: number, patch: Partial<TipArea>) => setAreas((as) => as.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const addArea = () => setAreas((as) => [...as, { name: "", percent: 0 }]);
  const removeArea = (i: number) => setAreas((as) => as.filter((_, idx) => idx !== i));

  const saveTips = async () => {
    setSavingTips(true); setTipMsg(null);
    const pp = Number(pointPct);
    if (!Number.isFinite(pp) || pp < 0 || pp > 100) { setTipMsg({ kind: "err", text: "Punto inválido (0 a 100%)." }); setSavingTips(false); return; }
    const clean = areas.map((a) => ({ name: a.name.trim(), percent: Number(a.percent) || 0 })).filter((a) => a.name);
    const r = await fetch("/api/admin/settings", {
      method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipPolicy: { pointPercent: pp, areas: clean } }),
    });
    const d = await r.json().catch(() => null);
    setSavingTips(false);
    if (d?.success) { setTipMsg({ kind: "ok", text: "Reparto guardado." }); load(); }
    else setTipMsg({ kind: "err", text: d?.error ?? "Error al guardar." });
  };

  if (session.loading || !session.user || session.user.role !== "ADMIN") {
    return <div style={S.page}><div style={{ padding: 40, color: C.dim }}>Cargando…</div></div>;
  }

  const logout = async () => { await session.logout(); router.replace("/login?mode=login"); };
  const dirty = !!settings && (taxEnabled !== settings.taxEnabled || Number(ratePct) / 100 !== Number(settings.taxRate) || Number(empDiscPct) !== Number(settings.employeeDiscountPercent ?? 50));

  return (
    <div style={S.page}>
      <main style={S.main}>
        <h1 style={S.h1}>Ajustes del restaurante</h1>

        <section style={S.panel}>
          <div style={S.panelHead}>Impuestos y descuentos</div>
          <div style={{ padding: "18px 20px" }}>
            <div style={S.toggleRow}>
              <div>
                <div style={{ color: C.cream, fontWeight: 700 }}>Cobrar IVA en las comandas</div>
                <div style={{ color: C.faint, fontSize: "0.8rem", marginTop: 3 }}>
                  Si se desactiva, los tickets muestran solo el Total (sin desglose de IVA). Afecta el cálculo de todas las comandas nuevas y recalculadas.
                </div>
              </div>
              <button
                onClick={() => setTaxEnabled((v) => !v)}
                style={{ ...S.switch, background: taxEnabled ? C.gold : "rgb(var(--sl-veil-rgb) / 0.15)" }}
                aria-pressed={taxEnabled}
              >
                <span style={{ ...S.knob, transform: taxEnabled ? "translateX(22px)" : "translateX(2px)" }} />
              </button>
            </div>

            <div style={{ marginTop: 22, opacity: taxEnabled ? 1 : 0.4, pointerEvents: taxEnabled ? "auto" : "none" }}>
              <label style={S.label}>Tasa de IVA (%)</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  style={{ ...S.input, width: 120 }}
                  inputMode="decimal"
                  value={ratePct}
                  onChange={(e) => setRatePct(e.target.value.replace(/[^\d.]/g, ""))}
                />
                <span style={{ color: C.dim }}>%</span>
              </div>
              <div style={{ color: C.faint, fontSize: "0.76rem", marginTop: 6 }}>México estándar: 16%.</div>
            </div>

            {/* #5 Descuento a empleados: % configurable que usa el atajo "empleado" del
                descuento a la cuenta en caja. */}
            <div style={{ marginTop: 22 }}>
              <label style={S.label}>Descuento a empleados (%)</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  style={{ ...S.input, width: 120 }}
                  inputMode="decimal"
                  value={empDiscPct}
                  onChange={(e) => setEmpDiscPct(e.target.value.replace(/[^\d.]/g, ""))}
                />
                <span style={{ color: C.dim }}>%</span>
              </div>
              <div style={{ color: C.faint, fontSize: "0.76rem", marginTop: 6 }}>Es el atajo &laquo;empleado&raquo; del descuento a la cuenta en caja. Estándar: 50%.</div>
            </div>

            {msg && (
              <p style={{ marginTop: 16, color: msg.kind === "ok" ? C.green : "var(--sl-danger-strong)", fontSize: "0.84rem" }}>
                {msg.kind === "ok" ? "✓ " : "⚠ "}{msg.text}
              </p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={save}
                disabled={saving || !dirty}
                style={{ ...S.save, opacity: saving || !dirty ? 0.5 : 1, cursor: saving || !dirty ? "default" : "pointer" }}
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
              {settings && (
                <span style={{ color: C.faint, fontSize: "0.74rem", alignSelf: "center" }}>
                  Última actualización: {new Date(settings.updatedAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}
                </span>
              )}
            </div>
          </div>
        </section>

        <section style={{ ...S.panel, marginTop: 18 }}>
          <div style={S.panelHead}>Reparto de propinas (puntos)</div>
          <div style={{ padding: "18px 20px" }}>
            <div style={{ color: C.faint, fontSize: "0.8rem", marginBottom: 16 }}>
              El <b style={{ color: C.cream }}>punto</b> es el % que se le resta a cada mesero sobre su venta total; ese monto se reparte a las áreas por su peso. La caja (Perla) solo lo consulta — no lo edita.
            </div>
            <label style={S.label}>Punto — % sobre la venta del mesero</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input style={{ ...S.input, width: 100 }} inputMode="decimal" value={pointPct} onChange={(e) => setPointPct(e.target.value.replace(/[^\d.]/g, ""))} />
              <span style={{ color: C.dim }}>%</span>
            </div>

            <label style={{ ...S.label, marginTop: 20 }}>Áreas de reparto (peso)</label>
            {areas.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <input style={{ ...S.input, flex: 1 }} value={a.name} onChange={(e) => setArea(i, { name: e.target.value })} placeholder="Área" />
                <input style={{ ...S.input, width: 78, textAlign: "right" }} inputMode="decimal" value={String(a.percent)} onChange={(e) => setArea(i, { percent: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} />
                <button onClick={() => removeArea(i)} style={S.rm} aria-label="Quitar área">×</button>
              </div>
            ))}
            <button onClick={addArea} style={S.ghost}>+ Agregar área</button>

            {tipMsg && <p style={{ marginTop: 16, color: tipMsg.kind === "ok" ? C.green : "var(--sl-danger-strong)", fontSize: "0.84rem" }}>{tipMsg.kind === "ok" ? "✓ " : "⚠ "}{tipMsg.text}</p>}
            <div style={{ marginTop: 20 }}>
              <button onClick={saveTips} disabled={savingTips} style={{ ...S.save, opacity: savingTips ? 0.5 : 1, cursor: savingTips ? "default" : "pointer" }}>{savingTips ? "Guardando…" : "Guardar reparto"}</button>
            </div>
          </div>
        </section>

        <ScheduleEditor />
      </main>
    </div>
  );
}

const C = {
  bg: "var(--sl-bg)",
  panel: "var(--sl-panel)",
  gold: "var(--sl-gold)",
  cream: "var(--sl-cream)",
  dim: "var(--sl-dim)",
  faint: "var(--sl-faint)",
  green: "var(--sl-green)",
  border: "var(--sl-border)",
  line: "var(--sl-line)",
};

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: C.bg },
  main: { padding: "22px", maxWidth: 720, margin: "0 auto" },
  h1: { margin: "0 0 18px", color: C.cream, fontSize: "1.4rem", fontWeight: 800 },
  panel: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" },
  panelHead: { padding: "12px 20px", borderBottom: `1px solid ${C.line}`, color: C.faint, fontSize: "0.66rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 },
  toggleRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18 },
  switch: { position: "relative", width: 48, height: 26, borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0, transition: "background 0.15s" },
  knob: { position: "absolute", top: 2, left: 0, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "transform 0.15s" },
  label: { display: "block", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint, fontWeight: 700, marginBottom: 6 },
  input: { padding: "11px 13px", borderRadius: 9, border: `1px solid ${C.line}`, background: "rgb(var(--sl-veil-rgb) / 0.05)", color: C.cream, fontSize: "0.95rem", fontFamily: "inherit" },
  save: { padding: "11px 20px", borderRadius: 9, border: "none", background: C.gold, color: "#fff", fontWeight: 700, fontSize: "0.85rem", fontFamily: "inherit" },
  rm: { width: 34, height: 34, borderRadius: 8, border: "1px solid var(--sl-danger-strong)", background: "transparent", color: "var(--sl-danger-strong)", fontSize: "1.1rem", cursor: "pointer", lineHeight: 1, flexShrink: 0 },
  ghost: { padding: "9px 16px", borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.dim, fontWeight: 600, fontSize: "0.82rem", fontFamily: "inherit", cursor: "pointer" },
};
