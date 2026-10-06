"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/session-client";
import { useStaffSession } from "@/lib/staff-session-client";
import { DateRangeBar, DEFAULT_FILTER, dateFilterQuery, type DateFilter } from "@/components/admin/DateRangeBar";
import { btn, useToasts, ToastHost } from "@/components/staff/ui";
import { AlmacenView } from "@/components/staff/almacen";

type MoveType = "ENTRADA" | "SALIDA" | "MERMA" | "AJUSTE";
interface Row {
  id: number; createdAt: string; type: MoveType; quantity: number; balanceAfter: number;
  reasonCode: string | null; reason: string | null; unitCost: number | null; supplier: string | null;
  item: { id: number; name: string; unit: string; category: { id: number; name: string } };
  createdBy: { id: number; fullName: string };
}
interface AuditData {
  movements: Row[];
  truncated: boolean;
  totals: Record<string, { count: number; sums?: { unit: string; sum: number }[] }>;
  byReason: { reasonCode: string; unit: string; sum: number }[];
}

const TYPE_META: Record<MoveType, { label: string; color: string; sign: string }> = {
  ENTRADA: { label: "Entrada", color: "var(--sl-green)", sign: "+" },
  SALIDA: { label: "Salida", color: "var(--sl-amber)", sign: "−" },
  MERMA: { label: "Merma", color: "var(--sl-red)", sign: "−" },
  AJUSTE: { label: "Ajuste", color: "var(--sl-gold)", sign: "=" },
};
const TYPES: MoveType[] = ["ENTRADA", "SALIDA", "MERMA", "AJUSTE"];

const fmtQ = (n: number) => String(Math.round(n * 1000) / 1000);
const fmt = (iso: string) => new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });

type Tab = "inventario" | "auditoria";
const TABS: { id: Tab; label: string }[] = [
  { id: "inventario", label: "Inventario" },
  { id: "auditoria", label: "Auditoría" },
];
const ALMACEN_ROLES = ["OPERATION", "CAPTAIN", "MANAGER", "KITCHEN"];

/**
 * /admin/almacen — una sola sección con dos pestañas (?tab=): Inventario y Auditoría.
 * Sin guard de permisos propio más allá del ADMIN del panel; cada pestaña depende de su API.
 */
export default function AdminAlmacenPage() {
  const router = useRouter();
  const session = useSession();
  // Switch de vista en estado local: cambiar de pestaña no navega ni recarga. El ?tab= solo
  // sirve para entrar directo a una vista (enlace «Auditoría» de la tablet) y se mantiene al día.
  const [tab, setTab] = useState<Tab>("inventario");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "auditoria") setTab("auditoria");
  }, []);
  const pick = (id: Tab) => {
    setTab(id);
    window.history.replaceState(null, "", `/admin/almacen?tab=${id}`);
  };

  useEffect(() => {
    if (session.loading) return;
    if (!session.user || session.user.role !== "ADMIN") router.replace("/login?mode=login");
  }, [session.loading, session.user, router]);

  if (session.loading || !session.user || session.user.role !== "ADMIN") {
    return <div style={S.page}><div style={{ padding: 40, color: C.dim }}>Cargando…</div></div>;
  }

  return (
    <div style={S.page}>
      <main style={S.main}>
        <h1 style={{ ...S.h1, marginBottom: 14 }}>Almacén</h1>
        <div role="tablist" aria-label="Vista del almacén" style={S.switch}>
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => pick(t.id)}
                style={{ ...S.switchBtn, ...(on ? S.switchOn : {}) }}>
                {t.label}
              </button>
            );
          })}
        </div>
        {tab === "inventario" ? <InventarioTab /> : <AuditoriaTab />}
      </main>
    </div>
  );
}

/**
 * Inventario: la MISMA <AlmacenView> de /staff/almacen. Su API solo admite sesión de PIN, así
 * que se opera con el rol REAL de esa sesión (Manager administra catálogo y ajustes; Cocina,
 * Operación y Capitán registran movimientos). Sin PIN, la pestaña lo pide y regresa aquí.
 */
function InventarioTab() {
  const { staff, loading } = useStaffSession();
  const { toasts, push, dismiss } = useToasts();
  const [adminMode, setAdminMode] = useState(false);

  if (loading) return <div style={{ padding: 40, color: C.dim }}>Cargando…</div>;

  if (!staff || !ALMACEN_ROLES.includes(staff.role)) {
    const next = encodeURIComponent("/admin/almacen?tab=inventario");
    return (
      <div style={S.pinCard}>
        <div style={{ color: C.cream, fontWeight: 700 }}>El inventario se opera con tu PIN de empleado.</div>
        <div style={{ color: C.dim, fontSize: "0.82rem", lineHeight: 1.45 }}>
          Es el mismo acceso de la tablet: Manager administra el catálogo y hace ajustes; Cocina,
          Operación y Capitán registran entradas y salidas.
        </div>
        <Link href={`/staff/login?next=${next}`} style={S.navBtn}>Entrar con PIN</Link>
      </div>
    );
  }

  const isManager = staff.role === "MANAGER";
  return (
    <>
      {isManager && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button style={adminMode ? btn.primary : btn.ghost} onClick={() => setAdminMode((v) => !v)}>
            {adminMode ? "Listo" : "Administrar catálogo"}
          </button>
        </div>
      )}
      <AlmacenView role={staff.role} push={push} adminMode={isManager && adminMode} />
      <ToastHost toasts={toasts} onClose={dismiss} />
    </>
  );
}

/** Auditoría de movimientos del almacén (solo lectura). ADMIN. */
function AuditoriaTab() {
  const session = useSession();
  const [filter, setFilter] = useState<DateFilter>(DEFAULT_FILTER);
  const [type, setType] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [itemId, setItemId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [data, setData] = useState<AuditData | null>(null);

  const load = useCallback(async () => {
    setData(null);
    const q = [
      dateFilterQuery(filter),
      type ? `type=${type}` : "",
      categoryId ? `categoryId=${categoryId}` : "",
      itemId ? `itemId=${itemId}` : "",
      staffId ? `staffId=${staffId}` : "",
    ].filter(Boolean).join("&");
    const r = await fetch(`/api/admin/almacen/movements?${q}`, { credentials: "same-origin" });
    const d = await r.json().catch(() => null);
    setData(d?.success ? (d.data as AuditData) : { movements: [], truncated: false, totals: {}, byReason: [] });
  }, [filter, type, categoryId, itemId, staffId]);

  useEffect(() => { if (session.user?.role === "ADMIN") load(); }, [session.user, load]);

  // Opciones de los selectores, derivadas de lo que vino en los datos.
  const rows = data?.movements ?? [];
  const catOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of rows) m.set(r.item.category.id, r.item.category.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const itemOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of rows) if (!categoryId || String(r.item.category.id) === categoryId) m.set(r.item.id, r.item.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, categoryId]);
  const staffOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of rows) m.set(r.createdBy.id, r.createdBy.fullName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const totals = data?.totals ?? {};
  const byReason = data?.byReason ?? [];

  return (
    <>
        <div style={{ ...S.headRow, justifyContent: "flex-end" }}>
          <DateRangeBar value={filter} onChange={setFilter} />
        </div>

        {/* Resumen del periodo */}
        <div style={S.cards}>
          {TYPES.map((t) => {
            const tt = totals[t] ?? { count: 0 };
            const sums = tt.sums ?? [];
            const isAjuste = t === "AJUSTE";
            const isMerma = t === "MERMA" && tt.count > 0;
            const sumsText = sums.length ? sums.map((s) => `${fmtQ(s.sum)} ${s.unit.toLowerCase()}`).join(" · ") : "0";
            return (
              <div key={t} style={{ ...S.card, ...(isMerma ? { borderColor: "var(--sl-red)" } : {}) }}>
                <div style={{ color: TYPE_META[t].color, fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>{TYPE_META[t].label}s</div>
                {isAjuste ? (
                  <>
                    <div style={{ color: C.cream, fontWeight: 800, fontSize: "1.5rem", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{tt.count}</div>
                    <div style={{ color: C.faint, fontSize: "0.72rem", marginTop: 2 }}>movimiento{tt.count === 1 ? "" : "s"}</div>
                    <div style={{ color: C.faint, fontSize: "0.66rem", marginTop: 5, lineHeight: 1.3 }}>la cantidad de un ajuste es un conteo, no un movimiento</div>
                  </>
                ) : (
                  <>
                    <div style={{ color: isMerma ? "var(--sl-red)" : C.cream, fontWeight: 800, fontSize: "1.3rem", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{sumsText}</div>
                    <div style={{ color: C.faint, fontSize: "0.72rem", marginTop: 2 }}>{tt.count} movimiento{tt.count === 1 ? "" : "s"}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {byReason.length > 0 && (
          <div style={{ color: C.dim, fontSize: "0.76rem", marginBottom: 16 }}>
            Por motivo: {byReason.map((r) => `${r.reasonCode}: ${fmtQ(r.sum)} ${r.unit.toLowerCase()}`).join(" · ")}
          </div>
        )}

        {/* Filtros */}
        <div style={S.filters}>
          <select style={S.select} value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo">
            <option value="">Todos los tipos</option>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
          </select>
          <select style={S.select} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setItemId(""); }} aria-label="Categoría">
            <option value="">Todas las categorías</option>
            {catOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select style={S.select} value={itemId} onChange={(e) => setItemId(e.target.value)} aria-label="Producto">
            <option value="">Todos los productos</option>
            {itemOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select style={S.select} value={staffId} onChange={(e) => setStaffId(e.target.value)} aria-label="Persona">
            <option value="">Todas las personas</option>
            {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>

        {data?.truncated && (
          <div style={S.truncated}>Se muestran los 500 más recientes del periodo; acota el rango o los filtros.</div>
        )}

        {/* Tabla */}
        {data === null ? (
          <div style={{ padding: 40, color: C.dim }}>Cargando…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, color: C.faint, textAlign: "center", border: `1px dashed ${C.line}`, borderRadius: 14 }}>Sin movimientos en este rango.</div>
        ) : (
          <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Fecha", "Producto", "Tipo", "Cantidad", "Saldo", "Motivo", "Comentario", "Quién"].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const m = TYPE_META[r.type];
                  return (
                    <tr key={r.id} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td style={{ ...S.td, whiteSpace: "nowrap", color: C.faint }}>{fmt(r.createdAt)}</td>
                      <td style={S.td}>
                        <div style={{ color: C.cream }}>{r.item.name}</div>
                        <div style={{ color: C.faint, fontSize: "0.7rem" }}>{r.item.category.name}</div>
                      </td>
                      <td style={S.td}><span style={{ ...S.pill, color: m.color, borderColor: m.color }}>{m.label}</span></td>
                      <td style={{ ...S.td, whiteSpace: "nowrap", color: C.cream, fontVariantNumeric: "tabular-nums" }}>{m.sign} {fmtQ(r.quantity)} {r.item.unit.toLowerCase()}</td>
                      <td style={{ ...S.td, whiteSpace: "nowrap", color: C.dim, fontVariantNumeric: "tabular-nums" }}>{fmtQ(r.balanceAfter)}</td>
                      <td style={{ ...S.td, color: r.reasonCode ? C.cream : C.faint }}>{r.reasonCode ?? "—"}</td>
                      <td style={{ ...S.td, color: C.dim }}>{r.reason ?? ""}</td>
                      <td style={{ ...S.td, whiteSpace: "nowrap", color: C.dim }}>{r.createdBy.fullName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}

const C = {
  bg: "var(--sl-bg)", panel: "var(--sl-panel)", gold: "var(--sl-gold)", cream: "var(--sl-cream)",
  dim: "var(--sl-dim)", faint: "var(--sl-faint)", border: "var(--sl-border)", line: "var(--sl-line)",
};

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: C.bg },
  main: { padding: "22px", maxWidth: 1100, margin: "0 auto" },
  headRow: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 },
  h1: { margin: 0, color: C.cream, fontSize: "1.4rem", fontWeight: 800 },
  switch: { display: "inline-flex", gap: 4, padding: 4, borderRadius: 12, background: C.panel, border: `1px solid ${C.border}`, marginBottom: 18 },
  switchBtn: { minHeight: 44, padding: "0 20px", borderRadius: 9, border: "none", background: "transparent", color: C.dim, fontFamily: "inherit", fontSize: "0.86rem", fontWeight: 700, cursor: "pointer" },
  switchOn: { background: C.gold, color: "var(--sl-on-accent)" },
  pinCard: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, maxWidth: 520, padding: "20px 22px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12 },
  navBtn: { display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 14px", borderRadius: 10, border: `1px solid ${C.gold}`, color: C.gold, fontSize: "0.8rem", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 10 },
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" },
  filters: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 },
  select: { padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.line}`, background: "var(--sl-field)", color: "var(--sl-on-field)", fontFamily: "inherit", fontSize: "0.8rem", colorScheme: "dark" },
  truncated: { padding: "10px 12px", borderRadius: 8, background: "rgba(217,83,79,0.12)", border: "1px solid rgba(217,83,79,0.4)", color: "#e9a3a0", fontSize: "0.8rem", marginBottom: 12 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", minWidth: 760 },
  th: { textAlign: "left", padding: "10px 12px", color: C.faint, fontSize: "0.66rem", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 800, background: C.panel, whiteSpace: "nowrap" },
  td: { padding: "9px 12px", verticalAlign: "top" },
  pill: { display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: "0.66rem", fontWeight: 700, border: "1px solid", whiteSpace: "nowrap" },
};
