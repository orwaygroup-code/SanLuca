"use client";

import { useCallback, useEffect, useState } from "react";
import { TagPill } from "./TagPill";
import { TagPicker } from "./TagPicker";
import type { TagColor } from "@/lib/tagColors";

/**
 * Editor de tags de una conversación. Va en el panel del thread abierto.
 *
 * Hidrata `initialTags` (vienen del response `/api/crm/whatsapp/conversations/[phone]`)
 * y vuelve a hacer fetch propio después de cualquier mutación para tener
 * el estado canónico (no asume optimismo agresivo).
 */
export interface EditorTag {
  id:     string;
  name:   string;
  color:  string;
  source?: "MANUAL" | "AUTO_RULE" | "AUTO_LLM";
}

export function ConversationTagsEditor({
  phone,
  initialTags,
  onChange,
}: {
  phone:       string;
  initialTags: EditorTag[];
  /** Llamado con el nuevo conjunto después de cada mutación exitosa. */
  onChange?:   (tags: EditorTag[]) => void;
}) {
  const [tags, setTags]         = useState<EditorTag[]>(initialTags);
  const [showPicker, setShow]   = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  // Si el padre re-renderiza con otros initialTags (ej. cambio de conversación),
  // adoptamos esos como nuevo baseline.
  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  const refresh = useCallback(async () => {
    const r = await fetch(
      `/api/crm/whatsapp/conversations/${encodeURIComponent(phone)}/tags`,
      { credentials: "same-origin" },
    );
    const d = await r.json();
    if (d?.success && Array.isArray(d.data?.tags)) {
      setTags(d.data.tags);
      onChange?.(d.data.tags);
    }
  }, [phone, onChange]);

  async function apply(body: { tagId?: string; name?: string; color?: TagColor }) {
    const r = await fetch(
      `/api/crm/whatsapp/conversations/${encodeURIComponent(phone)}/tags`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const d = await r.json();
    if (!r.ok || !d.success) {
      const msg = d.error === "tag_already_applied"
        ? "Ese tag ya está aplicado."
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
      `/api/crm/whatsapp/conversations/${encodeURIComponent(phone)}/tags/${tagId}`,
      { method: "DELETE", credentials: "same-origin" },
    );
    const d = await r.json();
    if (!r.ok || !d.success) {
      setErr(d.error ?? "Error al quitar tag");
      return;
    }
    await refresh();
  }

  /**
   * Toggle del source:
   *   AUTO_RULE/AUTO_LLM → MANUAL  (Fijar: protege del cron)
   *   MANUAL → AUTO_LLM            (Desfijar: el LLM puede volver a moverlo)
   * Para tags MANUAL que vinieron de una regla, el botón los pasa a AUTO_LLM
   * por simplicidad — el próximo cron de reglas lo aplicará de nuevo si la
   * regla matchea, dejándolo en AUTO_RULE.
   */
  async function toggleLock(tag: EditorTag) {
    const next = tag.source === "MANUAL" ? "AUTO_LLM" : "MANUAL";
    setErr(null);
    const r = await fetch(
      `/api/crm/whatsapp/conversations/${encodeURIComponent(phone)}/tags/${tag.id}`,
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

  return (
    <div style={{ padding: "10px 20px", borderBottom: "1px solid rgb(var(--sl-veil-rgb) / 0.06)", background: "var(--sl-panel2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", position: "relative" }}>
        <span style={{ fontSize: "0.7rem", color: "rgb(var(--sl-cream-rgb) / 0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 4 }}>
          Tags
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
        <div style={{ marginTop: 6, color: "#e05555", fontSize: "0.75rem" }}>⚠ {err}</div>
      )}
    </div>
  );
}
