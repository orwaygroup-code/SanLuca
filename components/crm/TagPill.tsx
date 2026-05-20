"use client";

import { swatch } from "@/lib/tagColors";

/**
 * Pill pequeña con el nombre del tag y color del token.
 * Si recibe `onRemove`, muestra "×" para quitar la asignación.
 *
 * Diseño optimizado para fondo oscuro (`#1c2628` / `#22302e`).
 */
export interface TagPillTag {
  id:    string;
  name:  string;
  color: string;
}

export function TagPill({
  tag,
  onRemove,
  size = "sm",
}: {
  tag:      TagPillTag;
  onRemove?: () => void;
  size?:    "xs" | "sm" | "md";
}) {
  const s = swatch(tag.color);
  const px = size === "xs" ? "1px 7px" : size === "sm" ? "2px 9px" : "4px 12px";
  const fs = size === "xs" ? "0.66rem" : size === "sm" ? "0.72rem" : "0.82rem";

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
        maxWidth: 180,
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      title={tag.name}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{tag.name}</span>
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
