"use client";

import { useEffect, useState } from "react";
import { TagPill } from "@/components/crm/TagPill";
import { TagPicker, type PickerTag } from "@/components/crm/TagPicker";

/**
 * Multi-selector de tags para filtros de campaña.
 * - Muestra los seleccionados como TagPill con × para quitar.
 * - Botón "+ Agregar tag" abre el TagPicker.
 * - El TagPicker excluye los ya seleccionados.
 *
 * Carga el catálogo de tags al montar para resolver id → {name, color}.
 */
export function TagMultiSelector({
  selectedTagIds,
  onChange,
}: {
  selectedTagIds: string[];
  onChange: (next: string[]) => void;
}) {
  const [catalog, setCatalog] = useState<PickerTag[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/crm/tags", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => { if (alive && d?.data?.tags) setCatalog(d.data.tags); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const selected = selectedTagIds
    .map((id) => catalog.find((t) => t.id === id))
    .filter(Boolean) as PickerTag[];

  function add(tagId: string) {
    if (!selectedTagIds.includes(tagId)) onChange([...selectedTagIds, tagId]);
  }
  function remove(tagId: string) {
    onChange(selectedTagIds.filter((id) => id !== tagId));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", minHeight: 32 }}>
        {selected.length === 0 && (
          <span style={{ color: "rgb(var(--sl-cream-rgb) / 0.4)", fontSize: "0.8rem" }}>
            Sin tags seleccionados — la campaña no enviará a nadie.
          </span>
        )}
        {selected.map((t) => (
          <TagPill
            key={t.id}
            tag={{ id: t.id, name: t.name, color: t.color, source: "MANUAL" }}
            onRemove={() => remove(t.id)}
            size="sm"
          />
        ))}

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            style={addBtn}
          >
            + Agregar tag
          </button>

          {pickerOpen && (
            <TagPicker
              excludeIds={selectedTagIds}
              onPick={(id) => add(id)}
              onCreate={async (name, color) => {
                // Crear tag via endpoint existente, después seleccionarlo
                const r = await fetch("/api/crm/tags", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, color }),
                });
                const d = await r.json().catch(() => ({}));
                if (d?.data?.tag?.id) {
                  setCatalog((prev) => [...prev, d.data.tag]);
                  add(d.data.tag.id);
                } else {
                  throw new Error(d?.error ?? "No se pudo crear el tag");
                }
              }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const addBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px dashed rgb(var(--sl-gold-rgb) / 0.5)",
  color: "var(--sl-gold)",
  fontFamily: "inherit",
  fontSize: "0.78rem",
  fontWeight: 600,
  padding: "4px 12px",
  borderRadius: 999,
  cursor: "pointer",
};
