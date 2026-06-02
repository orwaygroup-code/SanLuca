"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";

// ── Tipos y constantes ──────────────────────────────────────────────────
type Role = "WAITER" | "OPERATION" | "CAPTAIN" | "MANAGER";

interface StaffRow {
  id:          number;
  username:    string;
  fullName:    string;
  role:        Role;
  active:      boolean;
  lastLoginAt: string | null;
  lastShift:   string | null;
  createdAt:   string;
}

const ROLE_LABEL: Record<Role, string> = {
  WAITER: "Mesero", OPERATION: "Operación", CAPTAIN: "Capitán", MANAGER: "Manager",
};
const ROLE_COLOR: Record<Role, string> = {
  WAITER: "#4a9eca", OPERATION: "#b07cd6", CAPTAIN: "#ba843c", MANAGER: "#4caf50",
};
const ROLES: Role[] = ["WAITER", "OPERATION", "CAPTAIN", "MANAGER"];

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Mexico_City",
  });
}

// ── Página ───────────────────────────────────────────────────────────────
export default function StaffAdminPage() {
  const router = useRouter();
  const { staff: me, loading: authLoading } = useStaffSession();

  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [query, setQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffRow | null>(null);
  const [revealed, setRevealed] = useState<{ fullName: string; pin: string } | null>(null);

  // Gate: solo MANAGER. Redirige a login si no hay sesión de staff válida.
  useEffect(() => {
    if (authLoading) return;
    if (!me) { router.replace("/staff/login?next=/admin/staff"); return; }
    if (me.role !== "MANAGER") { router.replace("/staff/login"); }
  }, [authLoading, me, router]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (roleFilter) params.set("role", roleFilter);
    if (activeFilter) params.set("active", activeFilter);
    if (query.trim()) params.set("q", query.trim());
    const r = await fetch(`/api/admin/staff?${params}`, { credentials: "same-origin" });
    const data = await r.json().catch(() => null);
    if (data?.success) setRows(data.data as StaffRow[]);
    setLoading(false);
  }, [roleFilter, activeFilter, query]);

  useEffect(() => {
    if (me?.role === "MANAGER") fetchList();
  }, [me, fetchList]);

  const toggleActive = async (row: StaffRow) => {
    await fetch(`/api/admin/staff/${row.id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !row.active }),
    });
    await fetchList();
  };

  const resetPin = async (row: StaffRow) => {
    const r = await fetch(`/api/admin/staff/${row.id}/reset-pin`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await r.json().catch(() => null);
    if (data?.success) setRevealed({ fullName: row.fullName, pin: data.data.pin });
    else alert(data?.error === "PIN_TAKEN" ? "El PIN generado chocó, reintenta." : "Error al resetear PIN");
  };

  if (authLoading || !me || me.role !== "MANAGER") {
    return <div style={S.page}><p style={{ color: "rgba(245,241,232,0.5)", textAlign: "center", marginTop: 80 }}>Verificando acceso…</p></div>;
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.h1}><span style={{ color: "#ba843c" }}>EMPLEADOS</span> <span style={{ color: "#f5f1e8" }}>· MANAGER</span></h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: "0.78rem", color: "rgba(245,241,232,0.5)" }}>Hola, {me.fullName}</span>
          <button style={S.primaryBtn} onClick={() => setCreateOpen(true)}>+ Nuevo empleado</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={S.filters}>
        <select style={S.select} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as "" | Role)}>
          <option value="">Todos los roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <select style={S.select} value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as "" | "true" | "false")}>
          <option value="">Activos e inactivos</option>
          <option value="true">Solo activos</option>
          <option value="false">Solo inactivos</option>
        </select>
        <input
          style={S.search}
          placeholder="Buscar usuario o nombre…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchList()}
        />
      </div>

      {/* Tabla */}
      {loading ? (
        <p style={S.empty}>Cargando…</p>
      ) : rows.length === 0 ? (
        <p style={S.empty}>No hay empleados con esos filtros.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                {["Nombre", "Usuario", "Rol", "Estado", "Último acceso", "Acciones"].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ opacity: row.active ? 1 : 0.45 }}>
                  <td style={S.td}>{row.fullName}</td>
                  <td style={{ ...S.td, color: "rgba(245,241,232,0.6)" }}>{row.username}</td>
                  <td style={S.td}>
                    <span style={{ ...S.badge, borderColor: ROLE_COLOR[row.role], color: ROLE_COLOR[row.role] }}>
                      {ROLE_LABEL[row.role]}
                    </span>
                  </td>
                  <td style={S.td}>
                    <span style={{ color: row.active ? "#4caf50" : "#e05555", fontWeight: 600, fontSize: "0.78rem" }}>
                      {row.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={{ ...S.td, color: "rgba(245,241,232,0.55)", fontSize: "0.78rem" }}>{fmtDateTime(row.lastLoginAt)}</td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button style={S.miniBtn} onClick={() => setEditTarget(row)}>Editar</button>
                      <button style={S.miniBtn} onClick={() => resetPin(row)}>Reset PIN</button>
                      <button
                        style={{ ...S.miniBtn, borderColor: row.active ? "rgba(224,85,85,0.5)" : "rgba(76,175,80,0.5)", color: row.active ? "#e05555" : "#4caf50" }}
                        onClick={() => toggleActive(row)}
                        disabled={row.id === me.id}
                        title={row.id === me.id ? "No puedes desactivarte" : ""}
                      >
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

      {/* Modales */}
      {createOpen && (
        <StaffFormModal
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={(pin, fullName) => { setCreateOpen(false); if (pin) setRevealed({ fullName, pin }); fetchList(); }}
        />
      )}
      {editTarget && (
        <StaffFormModal
          mode="edit"
          row={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetchList(); }}
        />
      )}
      {revealed && <PinReveal fullName={revealed.fullName} pin={revealed.pin} onClose={() => setRevealed(null)} />}
    </div>
  );
}

// ── Modal de PIN revelado (se muestra UNA vez) ────────────────────────────
function PinReveal({ fullName, pin, onClose }: { fullName: string; pin: string; onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div style={{ textAlign: "center" }}>
        <p style={S.modalKicker}>PIN generado</p>
        <p style={{ color: "#f5f1e8", margin: "4px 0 0", fontWeight: 700 }}>{fullName}</p>
        <div style={{ margin: "20px 0", fontSize: "2.6rem", letterSpacing: "0.4em", color: "#ba843c", fontWeight: 800 }}>{pin}</div>
        <p style={{ color: "rgba(245,241,232,0.6)", fontSize: "0.82rem", margin: 0 }}>
          Anótalo ahora. No se puede volver a consultar; solo regenerar.
        </p>
        <button style={{ ...S.primaryBtn, marginTop: 22, width: "100%" }} onClick={onClose}>Entendido</button>
      </div>
    </Overlay>
  );
}

// ── Modal crear / editar ──────────────────────────────────────────────────
function StaffFormModal({
  mode, row, onClose, onSaved,
}: {
  mode: "create" | "edit";
  row?: StaffRow;
  onClose: () => void;
  onSaved: (pin: string | null, fullName: string) => void;
}) {
  const [username, setUsername] = useState(row?.username ?? "");
  const [fullName, setFullName] = useState(row?.fullName ?? "");
  const [role, setRole] = useState<Role>(row?.role ?? "WAITER");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        const r = await fetch("/api/admin/staff", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim().toLowerCase(), fullName: fullName.trim(), role, ...(pin ? { pin } : {}) }),
        });
        const data = await r.json().catch(() => null);
        if (!data?.success) throw new Error(mapErr(data?.error));
        onSaved(data.data.pin ?? null, fullName.trim());
      } else if (row) {
        const r = await fetch(`/api/admin/staff/${row.id}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName: fullName.trim(), role }),
        });
        const data = await r.json().catch(() => null);
        if (!data?.success) throw new Error(mapErr(data?.error));
        onSaved(null, fullName.trim());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
      setSaving(false);
    }
  };

  const pinOk = pin === "" || /^\d{4}$/.test(pin);
  const canSave = fullName.trim().length >= 2 && (mode === "edit" || (username.trim().length >= 3 && pinOk));

  return (
    <Overlay onClose={onClose}>
      <p style={S.modalKicker}>{mode === "create" ? "Nuevo empleado" : "Editar empleado"}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        <div>
          <label style={S.label}>Usuario</label>
          <input
            style={{ ...S.input, opacity: mode === "edit" ? 0.5 : 1 }}
            value={username}
            disabled={mode === "edit"}
            autoCapitalize="none"
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ej. luis.mesero"
          />
        </div>
        <div>
          <label style={S.label}>Nombre completo</label>
          <input style={S.input} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ej. Luis Hernández" />
        </div>
        <div>
          <label style={S.label}>Rol</label>
          <select style={S.input} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
        {mode === "create" && (
          <div>
            <label style={S.label}>PIN inicial (opcional)</label>
            <input
              style={S.input}
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Vacío = se genera automático"
            />
          </div>
        )}
        {error && <p style={{ color: "#e05555", fontSize: "0.82rem", margin: 0 }}>⚠ {error}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button style={S.ghostBtn} onClick={onClose}>Cancelar</button>
          <button
            style={{ ...S.primaryBtn, flex: 1, opacity: canSave && !saving ? 1 : 0.5 }}
            onClick={submit}
            disabled={!canSave || saving}
          >
            {saving ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function mapErr(code?: string): string {
  switch (code) {
    case "USERNAME_TAKEN": return "Ese usuario ya existe.";
    case "PIN_TAKEN":      return "Ese PIN ya está en uso por otro empleado.";
    default:               return code || "Error al guardar";
  }
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#1a2628", border: "1px solid rgba(186,132,60,0.25)", borderRadius: 16, width: "100%", maxWidth: 440, padding: "26px 24px" }}>
        {children}
      </div>
    </div>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#16201f", padding: "26px 20px", color: "#f5f1e8", fontFamily: "inherit" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  h1: { fontSize: "1.1rem", fontWeight: 800, letterSpacing: "0.08em", margin: 0 },
  filters: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 },
  select: { padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "#f5f1e8", fontSize: "0.82rem", fontFamily: "inherit" },
  search: { flex: 1, minWidth: 200, padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "#f5f1e8", fontSize: "0.82rem", fontFamily: "inherit" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" },
  th: { textAlign: "left", padding: "10px 12px", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,241,232,0.4)", borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap" },
  td: { padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.06)", verticalAlign: "middle" },
  badge: { display: "inline-block", padding: "2px 10px", borderRadius: 999, border: "1px solid", fontSize: "0.72rem", fontWeight: 600 },
  empty: { textAlign: "center", color: "rgba(245,241,232,0.4)", marginTop: 60 },
  primaryBtn: { padding: "9px 16px", borderRadius: 8, border: "1px solid #ba843c", background: "rgba(186,132,60,0.85)", color: "#fff", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit" },
  ghostBtn: { flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(245,241,232,0.6)", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" },
  miniBtn: { padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(186,132,60,0.4)", background: "transparent", color: "#ba843c", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  modalKicker: { fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#ba843c", fontWeight: 700, margin: 0 },
  label: { display: "block", fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,241,232,0.45)", fontWeight: 700, marginBottom: 5 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, boxSizing: "border-box", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#f5f1e8", fontSize: "0.88rem", fontFamily: "inherit" },
};
