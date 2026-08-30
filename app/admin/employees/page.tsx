"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-client";
import { GoldSelect } from "@/components/ui/GoldSelect";
import type { SelectOption } from "@/components/ui/GoldSelect";
import { dialogAlert } from "@/components/ui/DialogHost";

type Role = "WAITER" | "OPERATION" | "CAPTAIN" | "MANAGER" | "KITCHEN";

interface StaffRow {
  id: number; username: string; fullName: string; role: Role; active: boolean;
  lastLoginAt: string | null; createdAt: string;
}

const ROLE_LABEL: Record<Role, string> = { WAITER: "Mesero", OPERATION: "Operación", CAPTAIN: "Capitán", MANAGER: "Manager", KITCHEN: "Cocina" };
const ROLE_COLOR: Record<Role, string> = { WAITER: "#4a9eca", OPERATION: "#b07cd6", CAPTAIN: "#ba843c", MANAGER: "#4caf50", KITCHEN: "#c98a4a" };
const ROLES: Role[] = ["WAITER", "OPERATION", "CAPTAIN", "MANAGER", "KITCHEN"];

const ROLE_OPTIONS: SelectOption[] = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }));
const ROLE_FILTER_OPTIONS: SelectOption[] = [{ value: "", label: "Todos los roles" }, ...ROLE_OPTIONS];
const ACTIVE_FILTER_OPTIONS: SelectOption[] = [
  { value: "", label: "Activos e inactivos" },
  { value: "true", label: "Solo activos" },
  { value: "false", label: "Solo inactivos" },
];

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
}

export default function EmployeesPage() {
  const router = useRouter();
  const session = useSession();

  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffRow | null>(null);
  const [pinTarget, setPinTarget] = useState<StaffRow | null>(null);
  const [revealed, setRevealed] = useState<{ fullName: string; pin: string } | null>(null);

  useEffect(() => {
    if (session.loading) return;
    if (!session.user || session.user.role !== "ADMIN") router.replace("/login?mode=login");
  }, [session.loading, session.user, router]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (roleFilter) params.set("role", roleFilter);
    if (activeFilter) params.set("active", activeFilter);
    if (query.trim()) params.set("q", query.trim());
    const r = await fetch(`/api/admin/employees?${params}`, { credentials: "same-origin" });
    const data = await r.json().catch(() => null);
    if (data?.success) setRows(data.data as StaffRow[]);
    setLoading(false);
  }, [roleFilter, activeFilter, query]);

  useEffect(() => { if (session.user?.role === "ADMIN") fetchList(); }, [session.user, fetchList]);

  const toggleActive = async (row: StaffRow) => {
    const r = await fetch(`/api/admin/employees/${row.id}`, {
      method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !row.active }),
    });
    const d = await r.json().catch(() => null);
    if (!d?.success) void dialogAlert(d?.error ?? "Error");
    await fetchList();
  };

  if (session.loading || !session.user || session.user.role !== "ADMIN") {
    return <div style={S.page}><p style={S.empty}>Verificando acceso…</p></div>;
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.h1}><span style={{ color: "#ba843c" }}>EMPLEADOS</span></h1>
        <button style={S.primaryBtn} onClick={() => setCreateOpen(true)}>+ Nuevo empleado</button>
      </div>

      <div style={S.filters}>
        <GoldSelect
          value={roleFilter}
          onChange={(v) => setRoleFilter(v as "" | Role)}
          options={ROLE_FILTER_OPTIONS}
          placeholder="Todos los roles"
          style={{ minWidth: 170 }}
        />
        <GoldSelect
          value={activeFilter}
          onChange={(v) => setActiveFilter(v as "" | "true" | "false")}
          options={ACTIVE_FILTER_OPTIONS}
          placeholder="Activos e inactivos"
          style={{ minWidth: 180 }}
        />
        <input style={S.search} placeholder="Buscar usuario o nombre…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchList()} />
      </div>

      {loading ? <p style={S.empty}>Cargando…</p> : rows.length === 0 ? <p style={S.empty}>Sin empleados.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead><tr>{["Nombre", "Usuario", "Rol", "Estado", "Último acceso", "Acciones"].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ opacity: row.active ? 1 : 0.45 }}>
                  <td style={S.td}>{row.fullName}</td>
                  <td style={{ ...S.td, color: "rgba(245,241,232,0.72)" }}>{row.username}</td>
                  <td style={S.td}><span style={{ ...S.badge, borderColor: ROLE_COLOR[row.role], color: ROLE_COLOR[row.role] }}>{ROLE_LABEL[row.role]}</span></td>
                  <td style={S.td}><span style={{ color: row.active ? "#4caf50" : "#e8766b", fontWeight: 600, fontSize: "0.78rem" }}>{row.active ? "Activo" : "Inactivo"}</span></td>
                  <td style={{ ...S.td, color: "rgba(245,241,232,0.68)", fontSize: "0.78rem" }}>{fmtDateTime(row.lastLoginAt)}</td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button style={S.miniBtn} onClick={() => setEditTarget(row)}>Editar</button>
                      <button style={S.miniBtn} onClick={() => setPinTarget(row)}>Cambiar PIN</button>
                      <button style={{ ...S.miniBtn, borderColor: row.active ? "rgba(224,85,85,0.5)" : "rgba(76,175,80,0.5)", color: row.active ? "#e8766b" : "#4caf50" }} onClick={() => toggleActive(row)}>
                        {row.active ? "Desactivar" : "Reactivar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && <EmployeeFormModal mode="create" onClose={() => setCreateOpen(false)} onSaved={(pin, fullName) => { setCreateOpen(false); if (pin) setRevealed({ fullName, pin }); fetchList(); }} />}
      {editTarget && <EmployeeFormModal mode="edit" row={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); fetchList(); }} />}
      {pinTarget && <PinModal row={pinTarget} onClose={() => setPinTarget(null)} onDone={(pin, fullName) => { setPinTarget(null); setRevealed({ fullName, pin }); }} />}
      {revealed && <PinReveal fullName={revealed.fullName} pin={revealed.pin} onClose={() => setRevealed(null)} />}
    </div>
  );
}

function PinReveal({ fullName, pin, onClose }: { fullName: string; pin: string; onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div style={{ textAlign: "center" }}>
        <p style={S.kicker}>PIN asignado</p>
        <p style={{ color: "#f5f1e8", margin: "4px 0 0", fontWeight: 700 }}>{fullName}</p>
        <div style={{ margin: "20px 0", fontSize: "2.6rem", letterSpacing: "0.4em", color: "#ba843c", fontWeight: 800 }}>{pin}</div>
        <p style={{ color: "rgba(245,241,232,0.72)", fontSize: "0.84rem", margin: 0 }}>Anótalo ahora. No se puede volver a consultar; solo regenerar.</p>
        <button style={{ ...S.primaryBtn, marginTop: 22, width: "100%" }} onClick={onClose}>Entendido</button>
      </div>
    </Overlay>
  );
}

function PinModal({ row, onClose, onDone }: {
  row: StaffRow; onClose: () => void; onDone: (pin: string, fullName: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (usePin: boolean) => {
    setSaving(true); setError(null);
    const r = await fetch(`/api/admin/employees/${row.id}/reset-pin`, {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(usePin ? { pin } : {}),
    });
    const d = await r.json().catch(() => null);
    if (d?.success) { onDone(d.data.pin as string, row.fullName); }
    else { setError(mapErr(d?.error)); setSaving(false); }
  };

  const pinOk = /^\d{4}$/.test(pin);
  return (
    <Overlay onClose={onClose}>
      <p style={S.kicker}>Cambiar PIN</p>
      <p style={{ color: "#f5f1e8", margin: "6px 0 0", fontWeight: 700 }}>{row.fullName}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        <div>
          <label style={S.label}>Escribe el nuevo PIN (4 dígitos)</label>
          <input
            type="password" autoComplete="off"
            style={S.input} inputMode="numeric" maxLength={4} value={pin} autoFocus
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="ej. 4821"
          />
        </div>
        {error && <p style={{ color: "#e8766b", fontSize: "0.82rem", margin: 0 }}>⚠ {error}</p>}
        <button
          style={{ ...S.primaryBtn, opacity: pinOk && !saving ? 1 : 0.5 }}
          disabled={!pinOk || saving}
          onClick={() => submit(true)}
        >
          {saving ? "Guardando…" : "Guardar este PIN"}
        </button>
        <button style={S.ghostBtn} disabled={saving} onClick={() => submit(false)}>
          …o generar uno aleatorio
        </button>
      </div>
    </Overlay>
  );
}

function EmployeeFormModal({ mode, row, onClose, onSaved }: {
  mode: "create" | "edit"; row?: StaffRow; onClose: () => void; onSaved: (pin: string | null, fullName: string) => void;
}) {
  const [username, setUsername] = useState(row?.username ?? "");
  const [fullName, setFullName] = useState(row?.fullName ?? "");
  const [role, setRole] = useState<Role>(row?.role ?? "WAITER");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      if (mode === "create") {
        const r = await fetch("/api/admin/employees", {
          method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim().toLowerCase(), fullName: fullName.trim(), role, ...(pin ? { pin } : {}) }),
        });
        const d = await r.json().catch(() => null);
        if (!d?.success) throw new Error(mapErr(d?.error));
        onSaved(d.data.pin ?? null, fullName.trim());
      } else if (row) {
        const r = await fetch(`/api/admin/employees/${row.id}`, {
          method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim().toLowerCase(), fullName: fullName.trim(), role }),
        });
        const d = await r.json().catch(() => null);
        if (!d?.success) throw new Error(mapErr(d?.error));
        onSaved(null, fullName.trim());
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Error al guardar"); setSaving(false); }
  };

  const pinOk = pin === "" || /^\d{4}$/.test(pin);
  const canSave = fullName.trim().length >= 2 && username.trim().length >= 3 && (mode === "create" ? pinOk : true);

  return (
    <Overlay onClose={onClose}>
      <p style={S.kicker}>{mode === "create" ? "Nuevo empleado" : "Editar empleado"}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        <div>
          <label style={S.label}>Usuario</label>
          <input style={S.input} value={username} autoCapitalize="none" onChange={(e) => setUsername(e.target.value)} placeholder="ej. luis.mesero" />
        </div>
        <div>
          <label style={S.label}>Nombre completo</label>
          <input style={S.input} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ej. Luis Hernández" />
        </div>
        <div>
          <label style={S.label}>Rol</label>
          <GoldSelect value={role} onChange={(v) => setRole(v as Role)} options={ROLE_OPTIONS} placeholder="Selecciona rol" />
        </div>
        {mode === "create" && (
          <div>
            <label style={S.label}>PIN inicial (opcional)</label>
            <input type="password" autoComplete="off" style={S.input} inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Vacío = se genera automático" />
          </div>
        )}
        {error && <p style={{ color: "#e8766b", fontSize: "0.82rem", margin: 0 }}>⚠ {error}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button style={S.ghostBtn} onClick={onClose}>Cancelar</button>
          <button style={{ ...S.primaryBtn, flex: 1, opacity: canSave && !saving ? 1 : 0.5 }} onClick={submit} disabled={!canSave || saving}>{saving ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}</button>
        </div>
      </div>
    </Overlay>
  );
}

function mapErr(code?: string): string {
  switch (code) {
    case "USERNAME_TAKEN": return "Ese usuario ya existe.";
    case "PIN_TAKEN": return "Ese PIN ya está en uso por otro empleado.";
    default: return code || "Error al guardar";
  }
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--sl-panel)", border: "1px solid rgba(186,132,60,0.25)", borderRadius: 16, width: "100%", maxWidth: 440, padding: "26px 24px" }}>{children}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "var(--sl-bg)", padding: "0 0 40px", color: "#f5f1e8", fontFamily: "inherit" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "20px 20px 0", margin: "0 0 18px" },
  h1: { fontSize: "1.1rem", fontWeight: 800, letterSpacing: "0.08em", margin: 0 },
  filters: { display: "flex", gap: 10, flexWrap: "wrap", padding: "0 20px", marginBottom: 18 },
  select: { padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "#f5f1e8", fontSize: "0.82rem", fontFamily: "inherit" },
  search: { flex: 1, minWidth: 200, padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "#f5f1e8", fontSize: "0.82rem", fontFamily: "inherit" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" },
  th: { textAlign: "left", padding: "10px 20px", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,241,232,0.58)", borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap" },
  td: { padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", verticalAlign: "middle" },
  badge: { display: "inline-block", padding: "2px 10px", borderRadius: 999, border: "1px solid", fontSize: "0.72rem", fontWeight: 600 },
  empty: { textAlign: "center", color: "rgba(245,241,232,0.62)", marginTop: 60 },
  primaryBtn: { padding: "12px 18px", minHeight: 44, borderRadius: 9, border: "none", background: "var(--sl-gold)", color: "var(--sl-on-accent)", fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit" },
  ghostBtn: { flex: 1, padding: "12px 0", minHeight: 44, borderRadius: 9, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "rgba(245,241,232,0.72)", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" },
  miniBtn: { padding: "9px 14px", minHeight: 40, borderRadius: 8, border: "1px solid rgba(186,132,60,0.5)", background: "transparent", color: "#c9964a", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  kicker: { fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9964a", fontWeight: 700, margin: 0 },
  label: { display: "block", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,241,232,0.62)", fontWeight: 700, marginBottom: 5 },
  input: { width: "100%", padding: "12px 13px", minHeight: 44, borderRadius: 9, boxSizing: "border-box", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: "#f5f1e8", fontSize: "0.9rem", fontFamily: "inherit" },
};
