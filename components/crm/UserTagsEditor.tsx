"use client";

import { useCallback, useEffect, useState } from "react";
import { TagPill } from "./TagPill";
import { TagPicker } from "./TagPicker";
import type { TagColor } from "@/lib/tagColors";

/**
 * Editor de tags de un usuario (UserTag). Paralelo al de conversaciones.
 *
 * Estos son los tags del PERFIL del cliente — VIP, Inactivo, Cumpleañero,
 * Grupo grande para los AUTO_RULE, y cualquier tag MANUAL que el admin
 * aplique. Ver wiki [[Auto-tagging]] §UI.
 */
export interface UserEditorTag {
  id:     string;
  name:   string;
  color:  string;
  source?: "MANUAL" | "AUTO_RULE" | "AUTO_LLM";
}

export function UserTagsEditor({
  userId,
  initialTags,
  onChange,
  compact = false,
}: {
  userId:      string;
  initialTags: UserEditorTag[];
  onChange?:   (tags: UserEditorTag[]) => void;
  /** Si true, no muestra el botón "+ Tag" (read-only inline). */
  compact?:    boolean;
}) {
  const [tags, setTags]       = useState<UserEditorTag[]>(initialTags);
  const [showPicker, setShow] = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  useEffect(() => { setTags(initialTags); }, [initialTags]);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/crm/users/${userId}/tags`, { credentials: "same-origin" });
    const d = await r.json();
    if (d?.success && Array.isArray(d.data?.tags)) {
      setTags(d.data.tags);
      onChange?.(d.data.tags);
    }
  }, [userId, onChange]);

  async function apply(body: { tagId?: string; name?: string; color?: TagColor }) {
    const r = await fetch(`/api/crm/users/${userId}/tags`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok || !d.success) {
      const msg = d.error === "tag_already_applied"
        ? "Ese tag ya está aplicado a este usuario."
        : d.error === "tag_not_found_or_inactive"
        ? "El tag ya no está disponible."
        : d.error ?? "Error al aplicar tag";
      throw new Error(msg);
    }
    await refresh();
  }

  async function removeTag(tagId: string) {
    setErr(null);
    const r = await fetch(
      `/api/crm/users/${userId}/tags/${tagId}`,
      { method: "DELETE", credentials: "same-origin" },
    );
    const d = await r.json();
    if (!r.ok || !d.success) {
      setErr(d.error ?? "Error al quitar tag");
      return;
    }
    await refresh();
  }

  async function toggleLock(tag: UserEditorTag) {
    const next = tag.source === "MANUAL" ? "AUTO_RULE" : "MANUAL";
    setErr(null);
    const r = await fetch(
      `/api/crm/users/${userId}/tags/${tag.id}`,
      {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: next }),
      },
    );
    const d = await r.json();
    if (!r.ok || !d.success) {
      setErr(d.error ?? "Error al cambiar origen del tag");
      return;
    }
    await refresh();
  }

  // En modo compacto solo pintamos las pills (sin botón +Tag ni ×).
  if (compact) {
    return (
      <div style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
        {tags.map((t) => (
          <TagPill key={t.id} tag={t} size="xs" />
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 20px", borderBottom: "1px solid rgb(var(--sl-veil-rgb) / 0.06)", background: "var(--sl-panel)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", position: "relative" }}>
        <span style={{ fontSize: "0.7rem", color: "rgb(var(--sl-cream-rgb) / 0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 4 }}>
          Cliente
        </span>

        {tags.map((t) => (
          <TagPill
            key={t.id}
            tag={t}
            onRemove={() => removeTag(t.id)}
            onLockToggle={() => toggleLock(t)}
            size="sm"
          />
        ))}

        <div style={{ position: "relative", display: "inline-block" }}>
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            style={{
              padding: "2px 9px",
              borderRadius: 999,
              border: "1px dashed rgb(var(--sl-gold-rgb) / 0.5)",
              background: "transparent",
              color: "var(--sl-gold)",
              fontSize: "0.72rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              lineHeight: 1.4,
            }}
          >
            + Tag
          </button>

          {showPicker && (
            <TagPicker
              excludeIds={tags.map((t) => t.id)}
              onPick={(tagId) => apply({ tagId })}
              onCreate={(name, color) => apply({ name, color })}
              onClose={() => setShow(false)}
            />
          )}
        </div>
      </div>
      {err && (
        <div style={{ marginTop: 6, color: "var(--sl-danger-strong)", fontSize: "0.75rem" }}>⚠ {err}</div>
      )}
    </div>
  );
}
