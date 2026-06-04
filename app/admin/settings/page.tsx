"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-client";
import { AdminNav } from "@/components/admin/AdminNav";

interface Settings { taxEnabled: boolean; taxRate: number | string; updatedAt: string }

/** /admin/settings — toggle de IVA y tasa. Realm sl_session ADMIN (Ricardo). */
export default function AdminSettingsPage() {
  const router = useRouter();
  const session = useSession();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [ratePct, setRatePct] = useState("16");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

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
    const r = await fetch("/api/admin/settings", {
      method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taxEnabled, taxRate: rateNum }),
    });
    const d = await r.json().catch(() => null);
    setSaving(false);
    if (d?.success) { setMsg({ kind: "ok", text: "Ajustes guardados." }); load(); }
    else setMsg({ kind: "err", text: d?.error ?? "Error al guardar." });
  };

  if (session.loading || !session.user || session.user.role !== "ADMIN") {
    return <div style={S.page}><div style={{ padding: 40, color: C.dim }}>Cargando…</div></div>;
  }

  const logout = async () => { await session.logout(); router.replace("/login?mode=login"); };
  const dirty = !!settings && (taxEnabled !== settings.taxEnabled || Number(ratePct) / 100 !== Number(settings.taxRate));

  return (
    <div style={S.page}>
      <AdminNav userName={session.user.name} onLogout={logout} />
      <main style={S.main}>
        <h1 style={S.h1}>Ajustes del restaurante</h1>

        <section style={S.panel}>
          <div style={S.panelHead}>Impuestos (IVA)</div>
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
                style={{ ...S.switch, background: taxEnabled ? C.gold : "rgba(255,255,255,0.15)" }}
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

            {msg && (
              <p style={{ marginTop: 16, color: msg.kind === "ok" ? C.green : "#e05555", fontSize: "0.84rem" }}>
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
      </main>
    </div>
  );
}

const C = { bg: "#16201f", panel: "#1a2628", gold: "#ba843c", cream: "#f5f1e8", dim: "rgba(245,241,232,0.6)", faint: "rgba(245,241,232,0.4)", green: "#4caf50", border: "rgba(186,132,60,0.22)", line: "rgba(255,255,255,0.08)" };

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
  input: { padding: "11px 13px", borderRadius: 9, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.05)", color: C.cream, fontSize: "0.95rem", fontFamily: "inherit" },
  save: { padding: "11px 20px", borderRadius: 9, border: "none", background: C.gold, color: "#fff", fontWeight: 700, fontSize: "0.85rem", fontFamily: "inherit" },
};
