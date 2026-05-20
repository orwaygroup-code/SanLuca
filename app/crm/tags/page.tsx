"use client";

import { useCallback, useEffect, useState } from "react";
import { CrmPageHead } from "@/components/crm/CrmPageHead";
import { TagPill } from "@/components/crm/TagPill";
import { TAG_COLORS, swatch, type TagColor } from "@/lib/tagColors";

interface TagRow {
  id:           string;
  name:         string;
  color:        string;
  description:  string | null;
  isActive:     boolean;
  createdAt:    string;
  updatedAt:    string;
}

export default function TagsAdminPage() {
  const [tags, setTags]     = useState<TagRow[]>([]);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [includeInactive, setII] = useState(false);

  // Crear
  const [newName, setNewName]   = useState("");
  const [newColor, setNewColor] = useState<TagColor>("slate");
  const [newDesc, setNewDesc]   = useState("");
  const [creating, setCreating] = useState(false);

  // Edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName]   = useState("");
  const [editColor, setEditColor] = useState<TagColor>("slate");
  const [editDesc, setEditDesc]   = useState("");

  const load = useCallback(async () => {
    setLoad(true);
    setError(null);
    try {
      const params = includeInactive ? "?includeInactive=1" : "";
      const r = await fetch(`/api/crm/tags${params}`, { credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error ?? "load_failed");
      setTags(d.data.tags);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoad(false);
    }
  }, [includeInactive]);

  useEffect(() => { load(); }, [load]);

  async function createTag() {
    if (!newName.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const r = await fetch("/api/crm/tags", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          color: newColor,
          description: newDesc.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        throw new Error(d.error === "name_already_exists" ? "Ya existe un tag con ese nombre" : d.error);
      }
      setNewName(""); setNewDesc(""); setNewColor("slate");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(t: TagRow) {
    setEditingId(t.id);
    setEditName(t.name);
    setEditColor((TAG_COLORS as readonly string[]).includes(t.color) ? (t.color as TagColor) : "slate");
    setEditDesc(t.description ?? "");
  }
  function cancelEdit() { setEditingId(null); }

  async function saveEdit(id: string) {
    setError(null);
    try {
      const r = await fetch(`/api/crm/tags/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:        editName.trim(),
          color:       editColor,
          description: editDesc.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        throw new Error(d.error === "name_already_exists" ? "Ya existe un tag con ese nombre" : d.error);
      }
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  async function toggleActive(t: TagRow) {
    setError(null);
    try {
      // Reactivar = PATCH isActive:true; desactivar = DELETE (soft).
      const r = await fetch(`/api/crm/tags/${t.id}`, {
        method:  t.isActive ? "DELETE" : "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body:    t.isActive ? undefined : JSON.stringify({ isActive: true }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error ?? "Error");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div style={{ padding: "32px 40px", color: "#f5f1e8" }}>
      <CrmPageHead accent="Catálogo" title="Tags" sub="Etiquetas reusables para segmentación de conversaciones" />

      {/* Form: nuevo tag */}
      <div style={panel}>
        <div style={{ fontSize: "0.78rem", color: "rgba(245,241,232,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          Nuevo tag
        </div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 2fr auto", alignItems: "end" }}>
          <div>
            <label style={lab}>Nombre</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ej. VIP"
              style={ctrl}
              disabled={creating}
              maxLength={60}
            />
          </div>
          <div>
            <label style={lab}>Descripción (opcional)</label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Para qué sirve este tag"
              style={ctrl}
              disabled={creating}
              maxLength={300}
            />
          </div>
          <button onClick={createTag} disabled={creating || !newName.trim()} style={primaryBtn}>
            {creating ? "Creando…" : "+ Crear"}
          </button>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={lab}>Color</label>
          <ColorSwatches value={newColor} onChange={setNewColor} />
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(224,85,85,0.12)", color: "#e05555", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: "0.88rem" }}>
          ⚠ {error}
        </div>
      )}

      {/* Toggle inactive */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: "0.78rem", color: "rgba(245,241,232,0.5)" }}>
          {tags.length} tag{tags.length !== 1 ? "s" : ""}
        </span>
        <label style={{ fontSize: "0.82rem", color: "rgba(245,241,232,0.7)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={includeInactive} onChange={(e) => setII(e.target.checked)} />
          Mostrar inactivos
        </label>
      </div>

      {/* Tabla */}
      <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr>
              <th style={th}>Tag</th>
              <th style={th}>Color</th>
              <th style={th}>Descripción</th>
              <th style={th}>Estado</th>
              <th style={{ ...th, textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "rgba(245,241,232,0.4)", padding: 28 }}>Cargando…</td></tr>
            )}
            {!loading && tags.length === 0 && (
              <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "rgba(245,241,232,0.4)", padding: 28 }}>Sin tags todavía.</td></tr>
            )}
            {!loading && tags.map((t) => (
              <tr key={t.id} style={{ opacity: t.isActive ? 1 : 0.5 }}>
                <td style={td}>
                  {editingId === t.id ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} style={ctrl} maxLength={60} />
                  ) : (
                    <TagPill tag={t} size="sm" />
                  )}
                </td>
                <td style={td}>
                  {editingId === t.id ? (
                    <ColorSwatches value={editColor} onChange={setEditColor} />
                  ) : (
                    <code style={{ fontSize: "0.78rem", color: "rgba(245,241,232,0.65)" }}>{t.color}</code>
                  )}
                </td>
                <td style={td}>
                  {editingId === t.id ? (
                    <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} style={ctrl} maxLength={300} placeholder="—" />
                  ) : (
                    <span style={{ color: t.description ? "#f5f1e8" : "rgba(245,241,232,0.35)" }}>
                      {t.description ?? "—"}
                    </span>
                  )}
                </td>
                <td style={td}>
                  <span style={{ fontSize: "0.78rem", color: t.isActive ? "#5fa15f" : "#e05555" }}>
                    {t.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  {editingId === t.id ? (
                    <>
                      <button onClick={() => saveEdit(t.id)} style={smallBtn}>Guardar</button>{" "}
                      <button onClick={cancelEdit} style={ghostBtn}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(t)} style={ghostBtn}>Editar</button>{" "}
                      <button onClick={() => toggleActive(t)} style={t.isActive ? dangerBtn : ghostBtn}>
                        {t.isActive ? "Desactivar" : "Reactivar"}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ColorSwatches({ value, onChange }: { value: TagColor; onChange: (c: TagColor) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {TAG_COLORS.map((c) => {
        const sw = swatch(c);
        const active = c === value;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            title={c}
            style={{
              width: 22, height: 22, borderRadius: "50%",
              background: sw.bg,
              border: `2px solid ${active ? sw.text : sw.border}`,
              cursor: "pointer", padding: 0,
              boxShadow: active ? `0 0 0 2px ${sw.text}33` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────
const panel: React.CSSProperties = {
  background: "rgba(245,241,232,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 10,
  padding: 18,
  marginBottom: 18,
};
const lab:  React.CSSProperties = { display: "block", fontSize: "0.7rem", color: "rgba(245,241,232,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 };
const ctrl: React.CSSProperties = {
  width: "100%", background: "rgba(245,241,232,0.04)", color: "#f5f1e8",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
  padding: "7px 10px", fontSize: "0.88rem", fontFamily: "inherit", boxSizing: "border-box",
};
const th:   React.CSSProperties = { textAlign: "left", padding: "12px 14px", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(245,241,232,0.5)", borderBottom: "1px solid rgba(255,255,255,0.08)" };
const td:   React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "rgba(245,241,232,0.9)", verticalAlign: "middle" };
const primaryBtn: React.CSSProperties = { padding: "9px 16px", background: "#ba843c", color: "#1c2628", border: "none", borderRadius: 6, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" };
const ghostBtn:   React.CSSProperties = { padding: "5px 11px", background: "transparent", border: "1px solid rgba(186,132,60,0.4)", color: "#ba843c", borderRadius: 4, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" };
const smallBtn:   React.CSSProperties = { padding: "5px 11px", background: "#ba843c", color: "#1c2628", border: "none", borderRadius: 4, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const dangerBtn:  React.CSSProperties = { padding: "5px 11px", background: "transparent", border: "1px solid rgba(224,85,85,0.45)", color: "#e05555", borderRadius: 4, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" };
