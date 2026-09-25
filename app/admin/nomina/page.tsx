"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/session-client";
import { apiFetch } from "@/components/staff/types";
import { ROLE_LABEL } from "@/components/staff/ui";
import { currentSalary } from "@/lib/payroll";

/**
 * /admin/nomina — Nómina. La ve solo ADMIN con `payrollAccess` (el servidor es el guardia;
 * aquí hay guard de rol y manejo del 403). Muestra el sueldo VIGENTE y el crédito pendiente
 * por persona, y el neto de la quincena. Regla del módulo: el sueldo es una historia con
 * fecha, no una columna que se sobrescribe; aquí solo se AGREGA el siguiente registro.
 */

type Role = "WAITER" | "OPERATION" | "CAPTAIN" | "MANAGER" | "KITCHEN";
type Period = "SEMANAL" | "QUINCENAL" | "MENSUAL";
interface Salary { amount: number; period: Period; effectiveFrom: string; note: string | null }
interface NominaRow { id: number; fullName: string; username: string; role: Role; salary: Salary | null; credit: number; net: number; carry: number }
interface Totals { sinCreditoRestado: number; creditos: number; conCreditoRestado: number; sinSueldo: number }
interface NominaData { rows: NominaRow[]; totals: Totals }
interface SalaryHist { id: number; amount: number; period: Period; effectiveFrom: string; note: string | null; createdAt: string; createdBy: { fullName: string } }

const money = (n: number) => "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Mexico_City" });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
const todayMX = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
const PERIOD_LABEL: Record<Period, string> = { SEMANAL: "Semanal", QUINCENAL: "Quincenal", MENSUAL: "Mensual" };
const ROLE_COLOR: Record<string, string> = { WAITER: "#4a9eca", OPERATION: "#b07cd6", CAPTAIN: "var(--sl-gold)", MANAGER: "#4caf50", KITCHEN: "var(--sl-gold)" };

export default function NominaPage() {
  const router = useRouter();
  const session = useSession();
  const [data, setData] = useState<NominaData | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");
  const [salaryTarget, setSalaryTarget] = useState<NominaRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<NominaRow | null>(null);

  useEffect(() => {
    if (session.loading) return;
    if (!session.user || session.user.role !== "ADMIN") router.replace("/login?mode=login");
  }, [session.loading, session.user, router]);

  const load = useCallback(async () => {
    setState("loading");
    const r = await apiFetch<NominaData>("/api/admin/nomina");
    if (r.ok && r.data) { setData(r.data); setState("ok"); }
    else if (r.status === 403) setState("forbidden");
    else { setErrMsg(r.error ?? ""); setState("error"); }
  }, []);

  useEffect(() => { if (session.user?.role === "ADMIN") load(); }, [session.user, load]);

  const rows = data?.rows ?? [];
  const totals = data?.totals;
  // Crédito que no alcanzó a descontarse: SOLO de quien tiene sueldo (los sin sueldo están
  // fuera de las tres sumas del servidor; incluirlos rompería la identidad de la cuenta).
  const carryPendiente = useMemo(
    () => Math.round(rows.filter((r) => r.salary).reduce((a, r) => a + r.carry, 0) * 100) / 100,
    [rows],
  );

  if (session.loading || !session.user || session.user.role !== "ADMIN") {
    return <div style={S.page}><p style={S.empty}>Verificando acceso…</p></div>;
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.h1}><span style={{ color: "var(--sl-gold)" }}>NÓMINA</span></h1>
      </div>
      <p style={{ ...S.sub, padding: "0 20px", margin: "0 0 18px" }}>Sueldo vigente y crédito pendiente por persona. El pago es quincenal.</p>

      {state === "loading" && <p style={S.empty}>Cargando…</p>}

      {state === "forbidden" && (
        <div style={S.forbidBox}>
          <p style={{ color: "var(--sl-cream)", fontWeight: 800, fontSize: "1rem", margin: 0 }}>No tienes acceso a nómina</p>
          <p style={{ color: "rgb(var(--sl-cream-rgb) / 0.7)", fontSize: "0.85rem", margin: "10px 0 0", lineHeight: 1.5 }}>
            Alguien que ya lo tenga puede dártelo desde Empleados → Editar → Acceso a nómina.
          </p>
        </div>
      )}

      {state === "error" && (
        <div style={S.forbidBox}>
          <p style={{ color: "var(--sl-cream)", fontWeight: 700, margin: 0 }}>No se pudo cargar la nómina.</p>
          {errMsg && <p style={{ color: "var(--sl-danger)", fontSize: "0.82rem", margin: "8px 0 0" }}>{errMsg}</p>}
          <button style={{ ...S.primaryBtn, marginTop: 16 }} onClick={load}>Reintentar</button>
        </div>
      )}

      {state === "ok" && totals && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead><tr>{["Nombre", "Rol", "Sueldo vigente", "Crédito pendiente", "Neto a pagar", "Acciones"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ opacity: r.salary ? 1 : 0.6 }}>
                    <td style={S.td}>
                      <div style={{ color: "var(--sl-cream)" }}>{r.fullName}</div>
                      <div style={{ color: "rgb(var(--sl-cream-rgb) / 0.6)", fontSize: "0.76rem" }}>{r.username}</div>
                    </td>
                    <td style={S.td}><span style={{ ...S.badge, borderColor: ROLE_COLOR[r.role] ?? "var(--sl-gold)", color: ROLE_COLOR[r.role] ?? "var(--sl-gold)" }}>{ROLE_LABEL[r.role] ?? r.role}</span></td>
                    <td style={S.td}>
                      {r.salary ? (
                        <>
                          <div style={{ color: "var(--sl-cream)", fontWeight: 600 }}>{money(r.salary.amount)}</div>
                          <div style={{ color: "rgb(var(--sl-cream-rgb) / 0.6)", fontSize: "0.74rem" }}>{PERIOD_LABEL[r.salary.period]} · desde {fmtDate(r.salary.effectiveFrom)}</div>
                          {r.salary.note && <div style={{ color: "rgb(var(--sl-cream-rgb) / 0.6)", fontSize: "0.74rem" }}>{r.salary.note}</div>}
                        </>
                      ) : <span style={{ color: "var(--sl-amber)", fontWeight: 600 }}>Sin sueldo</span>}
                    </td>
                    <td style={S.td}>{r.credit > 0 ? <span style={{ color: "var(--sl-red)", fontWeight: 600 }}>{money(r.credit)}</span> : <span style={{ color: "rgb(var(--sl-cream-rgb) / 0.5)" }}>—</span>}</td>
                    <td style={S.td}>
                      <div style={{ color: "var(--sl-cream)", fontWeight: 800 }}>{money(r.net)}</div>
                      {r.carry > 0 && <div style={{ color: "var(--sl-red)", fontSize: "0.74rem" }}>quedan debiendo {money(r.carry)}</div>}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button style={S.miniBtn} onClick={() => setSalaryTarget(r)}>{r.salary ? "Cambiar sueldo" : "Asignar sueldo"}</button>
                        <button style={S.miniBtn} onClick={() => setHistoryTarget(r)}>Historial</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Resumen de la quincena — cuadra: sinCreditoRestado − creditos + carryPendiente = conCreditoRestado */}
          <div style={S.summary}>
            <p style={S.kicker}>Resumen de la quincena</p>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={S.sumRow}><span style={S.sumLabel}>Sin crédito restado</span><span style={S.sumVal}>{money(totals.sinCreditoRestado)}</span></div>
              <div style={S.sumRow}><span style={S.sumLabel}>Créditos pendientes</span><span style={S.sumVal}>− {money(totals.creditos)}</span></div>
              {carryPendiente > 0 && (
                <div style={S.sumRow}>
                  <span style={S.sumLabel}>Crédito que no alcanzó a descontarse <span style={{ color: "rgb(var(--sl-cream-rgb) / 0.5)", fontWeight: 400 }}>· alguien debe más de lo que gana esta quincena; ese sobrante sigue pendiente</span></span>
                  <span style={S.sumVal}>+ {money(carryPendiente)}</span>
                </div>
              )}
              <div style={{ ...S.sumRow, borderTop: "1px solid rgb(var(--sl-gold-rgb) / 0.3)", paddingTop: 10, marginTop: 2 }}>
                <span style={{ color: "var(--sl-cream)", fontWeight: 800 }}>Con crédito restado</span>
                <span style={{ color: "var(--sl-gold)", fontWeight: 800, fontSize: "1.3rem" }}>{money(totals.conCreditoRestado)}</span>
              </div>
            </div>
          </div>

          {totals.sinSueldo > 0 && (
            <p style={{ ...S.sub, padding: "0 20px", margin: "12px 0 0" }}>{totals.sinSueldo} persona(s) activa(s) sin sueldo asignado no entran en estas sumas.</p>
          )}
          <p style={{ ...S.sub, padding: "0 20px", margin: "8px 0 0" }}>
            Aquí solo se ven los créditos con estatus pendiente. Al pagar la quincena, márcalos como pagados en <Link href="/admin/creditos" style={{ color: "var(--sl-gold)" }}>Créditos de personal</Link>.
          </p>
        </>
      )}

      {salaryTarget && <SalaryModal row={salaryTarget} onClose={() => setSalaryTarget(null)} onSaved={() => { setSalaryTarget(null); load(); }} />}
      {historyTarget && <HistoryModal row={historyTarget} onClose={() => setHistoryTarget(null)} />}
    </div>
  );
}

function SalaryModal({ row, onClose, onSaved }: { row: NominaRow; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayMX());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amountNum = Number(amount);
  const amountOk = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= 999999.99;

  const submit = async () => {
    setSaving(true); setError(null);
    const r = await apiFetch(`/api/admin/nomina/${row.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountNum, effectiveFrom, ...(note.trim() ? { note: note.trim() } : {}) }),
    });
    if (r.ok) { onSaved(); } else { setError(r.error ?? "No se pudo guardar"); setSaving(false); }
  };

  return (
    <Overlay onClose={onClose}>
      <p style={S.kicker}>{row.salary ? "Cambiar sueldo" : "Asignar sueldo"}</p>
      <p style={{ color: "var(--sl-cream)", margin: "6px 0 0", fontWeight: 700 }}>{row.fullName}</p>
      {row.salary && <p style={{ color: "rgb(var(--sl-cream-rgb) / 0.6)", fontSize: "0.8rem", margin: "6px 0 0" }}>Hoy: {money(row.salary.amount)} desde {fmtDate(row.salary.effectiveFrom)}</p>}
      <p style={{ color: "rgb(var(--sl-cream-rgb) / 0.6)", fontSize: "0.78rem", margin: "12px 0 0", lineHeight: 1.5 }}>No se edita el sueldo anterior: se agrega uno nuevo con su fecha. El historial queda completo.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        <div>
          <label style={S.label}>Monto quincenal</label>
          <input style={S.input} inputMode="decimal" value={amount} autoFocus onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="ej. 3500" />
        </div>
        <div>
          <label style={S.label}>Vigente desde</label>
          <input style={S.input} type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </div>
        <div>
          <label style={S.label}>Nota (opcional)</label>
          <input style={S.input} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ej. aumento acordado en junta" />
        </div>
        {error && <p style={{ color: "var(--sl-danger)", fontSize: "0.82rem", margin: 0 }}>⚠ {error}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button style={S.ghostBtn} onClick={onClose}>Cancelar</button>
          <button style={{ ...S.primaryBtn, flex: 1, opacity: amountOk && !saving ? 1 : 0.5 }} disabled={!amountOk || saving} onClick={submit}>{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </Overlay>
  );
}

function HistoryModal({ row, onClose }: { row: NominaRow; onClose: () => void }) {
  const [hist, setHist] = useState<SalaryHist[] | null>(null);

  useEffect(() => {
    apiFetch<SalaryHist[]>(`/api/admin/nomina/${row.id}`).then((r) => setHist(r.ok ? (r.data ?? []) : []));
  }, [row.id]);

  const vigenteId = useMemo(() => {
    if (!hist) return null;
    const v = currentSalary(hist.map((h) => ({ ...h, effectiveFrom: new Date(h.effectiveFrom) })));
    return v ? v.id : null;
  }, [hist]);

  const now = Date.now();

  return (
    <Overlay onClose={onClose}>
      <p style={S.kicker}>Historial de sueldos</p>
      <p style={{ color: "var(--sl-cream)", margin: "6px 0 16px", fontWeight: 700 }}>{row.fullName}</p>
      {hist === null ? (
        <p style={{ color: "rgb(var(--sl-cream-rgb) / 0.62)" }}>Cargando…</p>
      ) : hist.length === 0 ? (
        <p style={{ color: "rgb(var(--sl-cream-rgb) / 0.62)" }}>Nunca se le ha asignado un sueldo.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "60vh", overflowY: "auto" }}>
          {hist.map((h) => {
            const future = new Date(h.effectiveFrom).getTime() > now;
            return (
              <div key={h.id} style={{ border: "1px solid rgb(var(--sl-veil-rgb) / 0.12)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--sl-cream)", fontWeight: 800 }}>{money(h.amount)} <span style={{ color: "rgb(var(--sl-cream-rgb) / 0.6)", fontWeight: 400, fontSize: "0.8rem" }}>· {PERIOD_LABEL[h.period]}</span></span>
                  {h.id === vigenteId ? <span style={{ ...S.badge, borderColor: "#4caf50", color: "#4caf50" }}>Vigente</span>
                    : future ? <span style={{ ...S.badge, borderColor: "var(--sl-amber)", color: "var(--sl-amber)" }}>Aún no aplica</span> : null}
                </div>
                <div style={{ color: "rgb(var(--sl-cream-rgb) / 0.72)", fontSize: "0.78rem", marginTop: 3 }}>Vigente desde {fmtDate(h.effectiveFrom)}</div>
                <div style={{ color: "rgb(var(--sl-cream-rgb) / 0.55)", fontSize: "0.72rem", marginTop: 2 }}>Capturado por {h.createdBy.fullName} el {fmtDateTime(h.createdAt)}</div>
                {h.note && <div style={{ color: "rgb(var(--sl-cream-rgb) / 0.72)", fontSize: "0.78rem", marginTop: 4 }}>{h.note}</div>}
              </div>
            );
          })}
        </div>
      )}
      <button style={{ ...S.primaryBtn, width: "100%", marginTop: 18 }} onClick={onClose}>Cerrar</button>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--sl-panel)", border: "1px solid rgb(var(--sl-gold-rgb) / 0.25)", borderRadius: 16, width: "100%", maxWidth: 440, padding: "26px 24px" }}>{children}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--sl-bg)", padding: "0 0 40px", color: "var(--sl-cream)", fontFamily: "inherit" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "20px 20px 0", margin: "0 0 6px" },
  h1: { fontSize: "1.1rem", fontWeight: 800, letterSpacing: "0.08em", margin: 0 },
  sub: { color: "rgb(var(--sl-cream-rgb) / 0.62)", fontSize: "0.82rem" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" },
  th: { textAlign: "left", padding: "10px 20px", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgb(var(--sl-cream-rgb) / 0.58)", borderBottom: "1px solid rgb(var(--sl-veil-rgb) / 0.1)", whiteSpace: "nowrap" },
  td: { padding: "12px 20px", borderBottom: "1px solid rgb(var(--sl-veil-rgb) / 0.06)", verticalAlign: "middle" },
  badge: { display: "inline-block", padding: "2px 10px", borderRadius: 999, border: "1px solid", fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap" },
  empty: { textAlign: "center", color: "rgb(var(--sl-cream-rgb) / 0.62)", marginTop: 60 },
  forbidBox: { textAlign: "center", maxWidth: 460, margin: "60px auto 0", padding: "28px 24px", border: "1px solid rgb(var(--sl-gold-rgb) / 0.25)", borderRadius: 16, background: "var(--sl-panel)" },
  primaryBtn: { padding: "12px 18px", minHeight: 44, borderRadius: 9, border: "none", background: "var(--sl-gold)", color: "var(--sl-on-accent)", fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit" },
  ghostBtn: { flex: 1, padding: "12px 0", minHeight: 44, borderRadius: 9, border: "1px solid rgb(var(--sl-veil-rgb) / 0.18)", background: "transparent", color: "rgb(var(--sl-cream-rgb) / 0.72)", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" },
  miniBtn: { padding: "9px 14px", minHeight: 40, borderRadius: 8, border: "1px solid rgb(var(--sl-gold-rgb) / 0.5)", background: "transparent", color: "var(--sl-gold)", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  kicker: { fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--sl-gold)", fontWeight: 700, margin: 0 },
  label: { display: "block", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgb(var(--sl-cream-rgb) / 0.62)", fontWeight: 700, marginBottom: 5 },
  input: { width: "100%", padding: "12px 13px", minHeight: 44, borderRadius: 9, boxSizing: "border-box", border: "1px solid rgb(var(--sl-veil-rgb) / 0.2)", background: "rgb(var(--sl-veil-rgb) / 0.05)", color: "var(--sl-cream)", fontSize: "0.9rem", fontFamily: "inherit", colorScheme: "dark" },
  summary: { margin: "22px 20px 0", padding: "18px 20px", border: "1px solid rgb(var(--sl-gold-rgb) / 0.3)", borderRadius: 14, background: "var(--sl-panel)", maxWidth: 520 },
  sumRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, fontSize: "0.86rem" },
  sumLabel: { color: "rgb(var(--sl-cream-rgb) / 0.75)" },
  sumVal: { color: "var(--sl-cream)", fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
};
