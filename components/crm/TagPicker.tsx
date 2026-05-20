"use client";

import { useEffect, useRef, useState } from "react";
import { TAG_COLORS, swatch, type TagColor } from "@/lib/tagColors";

/**
 * Combobox para añadir un tag a una conversación.
 *  - Autocomplete sobre /api/crm/tags (sólo activos).
 *  - Filtra por substring del input (case-insensitive).
 *  - Si no hay match exacto: muestra "+ Crear tag '<input>'" con selector de color.
 *  - Excluye tags ya aplicados (`excludeIds`).
 *
 * El padre decide cómo aplicar via callbacks:
 *   - `onPick(tagId)` → POST { tagId } al endpoint per-conversation.
 *   - `onCreate(name, color)` → POST { name, color } (upsert + apply).
 *
 * Cierra solo al `onClose` (click fuera, ESC, o tras pick exitoso).
 */
export interface PickerTag {
  id:    string;
  name:  string;
  color: string;
}

export function TagPicker({
  excludeIds = [],
  onPick,
  onCreate,
  onClose,
}: {
  excludeIds?: string[];
  onPick:    (tagId: string) => Promise<void> | void;
  onCreate:  (name: string, color: TagColor) => Promise<void> | void;
  onClose:   () => void;
}) {
  const [allTags, setAllTags] = useState<PickerTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState("");
  const [color, setColor]     = useState<TagColor>("slate");
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cargar catálogo
  useEffect(() => {
    let alive = true;
    fetch("/api/crm/tags", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => { if (alive && d?.data?.tags) setAllTags(d.data.tags); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Click fuera + ESC
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const available = allTags.filter((t) => !excludeIds.includes(t.id));
  const filtered  = q
    ? available.filter((t) => t.name.toLowerCase().includes(q))
    : available;
  const exactMatch = q
    ? available.find((t) => t.name.toLowerCase() === q)
    : null;
  const showCreate = q.length > 0 && !exactMatch;

  async function handlePick(tagId: string) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onPick(tagId);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al aplicar tag");
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (busy || !q) return;
    setBusy(true);
    setErr(null);
    try {
      await onCreate(query.trim(), color);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al crear tag");
      setBusy(false);
    }
  }

  return (
    <div
      ref={wrapRef}
      style={{
        position: "absolute",
        zIndex: 50,
        marginTop: 4,
        background: "#1c2628",
        border: "1px solid rgba(186,132,60,0.35)",
        borderRadius: 8,
        padding: 10,
        width: 280,
        boxShadow: "0 10px 40px rgba(0,0,0,0.55)",
      }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (filtered.length > 0 && !showCreate) handlePick(filtered[0].id);
            else if (showCreate) handleCreate();
          }
        }}
        placeholder="Buscar o crear tag…"
        style={{
          width: "100%",
          padding: "7px 10px",
          background: "#22302e",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 6,
          color: "#f5f1e8",
          fontFamily: "inherit",
          fontSize: "0.85rem",
          outline: "none",
          boxSizing: "border-box",
        }}
        disabled={busy}
      />

      {/* Lista de resultados */}
      <div
        style={{
          marginTop: 8,
          maxHeight: 180,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {loading ? (
          <p style={{ color: "rgba(245,241,232,0.4)", fontSize: "0.78rem", padding: 6, margin: 0 }}>Cargando…</p>
        ) : filtered.length === 0 && !showCreate ? (
          <p style={{ color: "rgba(245,241,232,0.4)", fontSize: "0.78rem", padding: 6, margin: 0 }}>
            {available.length === 0 ? "No hay tags disponibles." : "Sin coincidencias."}
          </p>
        ) : (
          filtered.map((t) => {
            const sw = swatch(t.color);
            return (
              <button
                key={t.id}
                onClick={() => handlePick(t.id)}
                disabled={busy}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "6px 8px",
                  background: "transparent",
                  border: "none",
                  borderRadius: 4,
                  color: "#f5f1e8",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  fontSize: "0.83rem",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(245,241,232,0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span
                  aria-hidden
                  style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: sw.bg, border: `1px solid ${sw.border}`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.name}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Crear nuevo */}
      {showCreate && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ fontSize: "0.72rem", color: "rgba(245,241,232,0.5)", marginBottom: 6 }}>
            Color para el tag nuevo:
          </div>
          <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
            {TAG_COLORS.map((c) => {
              const sw = swatch(c);
              const active = c === color;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`color ${c}`}
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
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            style={{
              width: "100%",
              padding: "7px 10px",
              background: "#ba843c",
              color: "#1c2628",
              border: "none",
              borderRadius: 6,
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {busy ? "Creando…" : `+ Crear tag “${query.trim()}”`}
          </button>
        </div>
      )}

      {err && (
        <div style={{ marginTop: 8, color: "#e05555", fontSize: "0.75rem" }}>⚠ {err}</div>
      )}
    </div>
  );
}
