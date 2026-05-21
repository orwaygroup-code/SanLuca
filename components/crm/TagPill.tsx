"use client";

import { swatch } from "@/lib/tagColors";

/**
 * Pill con el nombre del tag + color del token.
 *
 * Fase 2 (auto-tagging): muestra un mini-icono según `source`:
 *   👤 MANUAL · ⚙️ AUTO_RULE · 🤖 AUTO_LLM.
 * Tooltip explica el origen al pasar el mouse.
 *
 * Si `onRemove` está presente → botón "×" para quitar.
 * Si `onLockToggle` está presente y el tag NO es MANUAL → botón 🔒 para
 * promoverlo a MANUAL (Fijar). Si ES MANUAL, el botón se muestra como 🔓
 * para volver al source AUTO_* (la decisión de a cuál lo pasa el caller).
 */

export type TagPillSource = "MANUAL" | "AUTO_RULE" | "AUTO_LLM";

export interface TagPillTag {
  id:    string;
  name:  string;
  color: string;
  source?: TagPillSource;
}

const SOURCE_META: Record<TagPillSource, { icon: string; tooltip: string }> = {
  MANUAL:    { icon: "👤", tooltip: "Aplicado manualmente" },
  AUTO_RULE: { icon: "⚙️", tooltip: "Aplicado automáticamente por regla" },
  AUTO_LLM:  { icon: "🤖", tooltip: "Inferido por IA del contenido de la conversación" },
};

export function TagPill({
  tag,
  onRemove,
  onLockToggle,
  size = "sm",
}: {
  tag:          TagPillTag;
  onRemove?:    () => void;
  /** Cambia entre MANUAL ↔ AUTO_*. El caller decide a cuál promueve/demueve. */
  onLockToggle?: () => void;
  size?:        "xs" | "sm" | "md";
}) {
  const s  = swatch(tag.color);
  const px = size === "xs" ? "1px 7px" : size === "sm" ? "2px 9px" : "4px 12px";
  const fs = size === "xs" ? "0.66rem" : size === "sm" ? "0.72rem" : "0.82rem";

  const source = tag.source ?? "MANUAL";
  const meta   = SOURCE_META[source];
  const isManual = source === "MANUAL";

  const fullTooltip = `${tag.name} · ${meta.tooltip}`;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: px,
        borderRadius: 999,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        fontSize: fs,
        fontWeight: 600,
        fontFamily: "inherit",
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        maxWidth: 200,
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      title={fullTooltip}
    >
      <span
        aria-hidden
        style={{ fontSize: "0.85em", opacity: 0.85, lineHeight: 1 }}
        title={meta.tooltip}
      >
        {meta.icon}
      </span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{tag.name}</span>

      {onLockToggle && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onLockToggle(); }}
          aria-label={isManual ? `Desfijar tag ${tag.name}` : `Fijar tag ${tag.name}`}
          title={isManual ? "Desfijar (volver a automático)" : "Fijar (proteger del cron)"}
          style={{
            background: "transparent",
            border: "none",
            color: s.text,
            cursor: "pointer",
            padding: 0,
            margin: 0,
            fontSize: "0.85em",
            lineHeight: 1,
            opacity: 0.55,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.55")}
        >
          {isManual ? "🔓" : "🔒"}
        </button>
      )}

      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={`Quitar tag ${tag.name}`}
          style={{
            background: "transparent",
            border: "none",
            color: s.text,
            cursor: "pointer",
            padding: 0,
            margin: 0,
            fontSize: "0.9em",
            lineHeight: 1,
            opacity: 0.7,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
        >
          ×
        </button>
      )}
    </span>
  );
}
