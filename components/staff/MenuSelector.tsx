"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { C, btn, fld, formatMXN, Spinner, EmptyState } from "./ui";
import { apiFetch } from "./types";

/**
 * Selector de platillos a PANTALLA COMPLETA (comandero). Reemplaza el modal.
 * Diseño Operate (DESIGN.md): oscuro fijo, dorado con tinta oscura, táctil ≥44px,
 * AA real. Navegación en 3 niveles reales sin curación de datos:
 *   Clase (Alimentos=COCINA / Bebidas=BARRA, vía prepArea) → Sección (categoría)
 *   → Producto (tarjeta con foto, o tarjeta tipográfica si no hay imagen).
 * El buscador es atajo transversal. Cantidad entera por ahora (decimales = Fase B).
 */

type Area = "COCINA" | "BARRA";
type Turno = "comida" | "brunch";
interface CartaRef { id: string; name: string; turno: "COMIDA" | "BRUNCH"; clase: Area; position: number | null }
interface Dish { id: string; name: string; price: number; description: string | null; imageUrl: string | null; prepArea: Area | null }
interface Cat { id: string; name: string; dishes: Dish[]; carta: CartaRef | null }
interface FlatDish extends Dish { catId: string; catName: string; cartaId: string; cartaName: string; turno: Turno }

// Turno + carta REALES desde la estructura de la BD. Fallback al hack "(Brunch)"
// solo si una categoría aún no tiene carta asignada (no debería tras la migración).
const turnoOf = (cat: Cat): Turno => (cat.carta ? (cat.carta.turno === "BRUNCH" ? "brunch" : "comida") : (/\(brunch\)/i.test(cat.name) ? "brunch" : "comida"));
const cartaIdOf = (cat: Cat): string => cat.carta?.id ?? "_sin";
const cartaNameOf = (cat: Cat): string => cat.carta?.name ?? "Otros";
const cleanSection = (name: string) => name.replace(/\s*\(brunch\)\s*/i, "").trim(); // "Cafetería (Brunch)" → "Cafetería"
const fmtQty = (q: number) => String(Math.round(q * 100) / 100); // 0.5, 1.5, 2 — sin ruido de float
const clampQty = (v: number) => Math.round(Math.max(0.1, Math.min(99, v)) * 10) / 10; // paso 0.1, [0.1, 99]

export function MenuSelector({ open, onClose, onAdd, busy }: {
  open: boolean;
  onClose: () => void;
  onAdd: (dishId: string, quantity: number, modifiers: string | null, kitchenNotes: string | null) => Promise<boolean>;
  busy: boolean;
}) {
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turno, setTurno] = useState<Turno>("comida");
  const [carta, setCarta] = useState<string>(""); // cartaId; "" hasta auto-seleccionar la 1ª del turno
  const [section, setSection] = useState<string>(""); // "" = todas
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FlatDish | null>(null);
  const [qty, setQty] = useState(1);
  const [comment, setComment] = useState("");
  const [added, setAdded] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState<Set<string>>(new Set());

  const loadMenu = useCallback(() => {
    setError(null);
    apiFetch<Cat[]>("/api/comandas/menu").then((r) => {
      if (r.ok) setCats(r.data ?? []);
      else setError(r.error ?? "No se pudo cargar el menú");
    });
  }, []);

  useEffect(() => {
    if (open && !cats) loadMenu();
    if (!open) { setSelected(null); setQuery(""); setSection(""); setAdded(0); }
  }, [open, cats, loadMenu]);

  // Cerrar con Escape (teclado / accesibilidad).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (selected) setSelected(null); else onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected, onClose]);

  const allDishes: FlatDish[] = useMemo(
    () => (cats ?? []).flatMap((cat) => cat.dishes.map((d) => ({ ...d, catId: cat.id, catName: cat.name, cartaId: cartaIdOf(cat), cartaName: cartaNameOf(cat), turno: turnoOf(cat) }))),
    [cats],
  );

  // Cartas del turno actual (nivel 2).
  const cartas = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of allDishes) if (d.turno === turno && !seen.has(d.cartaId)) seen.set(d.cartaId, d.cartaName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [allDishes, turno]);

  // Categorías (secciones) de la carta elegida (nivel 3).
  const sections = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of allDishes) if (d.turno === turno && d.cartaId === carta && !seen.has(d.catId)) seen.set(d.catId, cleanSection(d.catName));
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [allDishes, turno, carta]);

  // Al cambiar de turno (o al cargar), fija la primera carta disponible.
  useEffect(() => {
    if (cartas.length && !cartas.some((c) => c.id === carta)) { setCarta(cartas[0].id); setSection(""); }
  }, [cartas, carta]);

  const searching = query.trim().length > 0;
  const dishes = useMemo(() => {
    if (searching) {
      const q = query.trim().toLowerCase();
      return allDishes.filter((d) => d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q));
    }
    return allDishes.filter((d) => d.turno === turno && d.cartaId === carta && (section === "" || d.catId === section));
  }, [allDishes, searching, query, turno, carta, section]);

  const pick = (d: FlatDish) => { setSelected(d); setQty(1); setComment(""); };
  const confirmAdd = async () => {
    if (!selected) return;
    const label = `${fmtQty(qty)}× ${selected.name}`;
    const ok = await onAdd(selected.id, qty, null, comment.trim() || null);
    if (ok) {
      setAdded((n) => n + qty);
      setFlash(label);
      setSelected(null);
      window.setTimeout(() => setFlash((f) => (f === label ? null : f)), 1800);
    }
  };

  if (!open) return null;

  return (
    <div style={s.root} role="dialog" aria-label="Agregar platillos">
      {/* Barra superior */}
      <header style={s.head}>
        <button style={s.close} onClick={onClose} aria-label="Volver a la comanda">←</button>
        <div style={{ minWidth: 0, textAlign: "center" }}>
          <div style={s.title}>Agregar platillos</div>
          <div style={s.sub}>{added > 0 ? `${added} agregado${added === 1 ? "" : "s"}` : "Toca un platillo"}</div>
        </div>
        <button style={{ ...btn.primary, minWidth: 92 }} onClick={onClose}>Listo</button>
      </header>

      {cats === null ? (
        error ? (
          <div style={s.center}>
            <div style={{ color: C.red, marginBottom: 16 }}>{error}</div>
            <button style={btn.primary} onClick={loadMenu}>Reintentar</button>
          </div>
        ) : <Spinner label="Cargando menú…" />
      ) : (
        <>
          {/* Buscador */}
          <div style={s.searchWrap}>
            <input
              style={{ ...fld.input, paddingRight: query ? 44 : 14 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar platillo…"
              aria-label="Buscar platillo"
            />
            {query && <button style={s.clearSearch} onClick={() => setQuery("")} aria-label="Limpiar búsqueda">×</button>}
          </div>

          {/* Turno (Comida / Brunch) — nivel más amplio */}
          {!searching && (
            <div style={s.turnoRow}>
              {([["comida", "Comida"], ["brunch", "Brunch"]] as const).map(([val, label]) => {
                const on = turno === val;
                return (
                  <button
                    key={val}
                    onClick={() => { setTurno(val); setSection(""); }}
                    aria-pressed={on}
                    style={{ ...s.turnoTab, ...(on ? s.turnoTabOn : {}) }}
                  >{label}</button>
                );
              })}
            </div>
          )}

          {/* Carta (cartas del turno) — nivel 2 */}
          {!searching && cartas.length > 0 && (
            <div style={s.chips}>
              {cartas.map((ca) => (
                <button
                  key={ca.id}
                  onClick={() => { setCarta(ca.id); setSection(""); }}
                  aria-pressed={carta === ca.id}
                  style={{ ...s.chip, minHeight: 44, fontWeight: 700, ...(carta === ca.id ? s.chipOn : {}) }}
                >{ca.name}</button>
              ))}
            </div>
          )}

          {/* Secciones */}
          {!searching && sections.length > 0 && (
            <div style={s.chips}>
              <button onClick={() => setSection("")} style={{ ...s.chip, ...(section === "" ? s.chipOn : {}) }}>Todas</button>
              {sections.map((sec) => (
                <button key={sec.id} onClick={() => setSection(sec.id)} style={{ ...s.chip, ...(section === sec.id ? s.chipOn : {}) }}>
                  {sec.name}
                </button>
              ))}
            </div>
          )}

          {/* Rejilla de platillos */}
          <div style={s.grid}>
            {dishes.length === 0 ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <EmptyState text={searching ? "Sin resultados para tu búsqueda." : "No hay platillos en esta sección."} />
              </div>
            ) : dishes.map((d) => {
              const hasImg = !!d.imageUrl && !imgFailed.has(d.id);
              return (
                <button key={d.id} style={s.card} onClick={() => pick(d)}>
                  {hasImg ? (
                    <div style={s.cardImgWrap}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={d.imageUrl!}
                        alt=""
                        loading="lazy"
                        style={s.cardImg}
                        onError={() => setImgFailed((prev) => { const n = new Set(prev); n.add(d.id); return n; })}
                      />
                    </div>
                  ) : (
                    <div style={s.cardText}>
                      <span style={s.cardTextName}>{d.name}</span>
                      {d.description && <span style={s.cardDesc}>{d.description}</span>}
                    </div>
                  )}
                  <div style={s.cardFoot}>
                    {hasImg && <span style={s.cardFootName}>{d.name}</span>}
                    <span style={s.price}>{formatMXN(d.price)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Confirmación efímera */}
      {flash && <div style={s.flash} role="status">✓ {flash} agregado</div>}

      {/* Hoja inferior: cantidad + comentario */}
      {selected && (
        <>
          <div style={s.sheetScrim} onClick={() => setSelected(null)} />
          <div style={s.sheet} role="dialog" aria-label={`Agregar ${selected.name}`}>
            <div style={s.sheetGrip} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={s.sheetName}>{selected.name}</div>
                <div style={s.sheetPrice}>{formatMXN(selected.price)} c/u</div>
              </div>
              <button style={s.close} onClick={() => setSelected(null)} aria-label="Cancelar">×</button>
            </div>

            <label style={{ ...fld.label, marginTop: 18 }}>Cantidad</label>
            <div style={s.quickRow}>
              {([["½", 0.5], ["1", 1], ["1½", 1.5], ["2", 2], ["3", 3]] as const).map(([lbl, v]) => (
                <button key={lbl} onClick={() => setQty(v)} aria-pressed={qty === v} style={{ ...s.quick, ...(qty === v ? s.quickOn : {}) }}>{lbl}</button>
              ))}
            </div>
            <div style={s.qtyRow}>
              <button style={s.qtyBtn} onClick={() => setQty((q) => clampQty(q - 0.1))} aria-label="Menos 0.1">−</button>
              <span style={s.qtyVal}>{fmtQty(qty)}</span>
              <button style={s.qtyBtn} onClick={() => setQty((q) => clampQty(q + 0.1))} aria-label="Más 0.1">+</button>
            </div>
            <div style={s.qtyHint}>Pasos de 0.1 · media orden = ½ (0.5). Se cobra proporcional: {fmtQty(qty)} × precio.</div>

            <label style={{ ...fld.label, marginTop: 16 }}>Comentario a cocina (opcional)</label>
            <input
              style={fld.input}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="ej. sin cebolla, término medio, extra pan"
              autoFocus
            />

            <button
              style={{ ...btn.primary, width: "100%", marginTop: 20, minHeight: 52, fontSize: "0.95rem", opacity: busy ? 0.6 : 1 }}
              onClick={confirmAdd}
              disabled={busy}
            >
              {busy ? "Agregando…" : `Agregar ${fmtQty(qty)} · ${formatMXN(Math.round(selected.price * qty * 100) / 100)}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { position: "fixed", inset: 0, zIndex: 90, background: C.bg, display: "flex", flexDirection: "column" },
  head: {
    display: "grid", gridTemplateColumns: "44px 1fr auto", alignItems: "center", gap: 12,
    padding: "12px 16px", background: C.panel, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0,
  },
  close: {
    width: 44, height: 44, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent",
    color: C.cream, fontSize: "1.25rem", cursor: "pointer", flexShrink: 0,
  },
  title: { color: C.cream, fontWeight: 800, fontSize: "1rem", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  sub: { color: C.faint, fontSize: "0.72rem", marginTop: 2 },
  center: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 },

  searchWrap: { position: "relative", padding: "12px 16px 6px" },
  clearSearch: {
    position: "absolute", right: 24, top: 18, width: 32, height: 32, borderRadius: 8,
    border: "none", background: "transparent", color: C.dim, fontSize: "1.3rem", cursor: "pointer", lineHeight: 1,
  },

  turnoRow: { display: "flex", gap: 8, padding: "10px 16px 2px" },
  turnoTab: {
    flex: 1, minHeight: 46, borderRadius: 12, border: `1px solid ${C.line}`, background: "transparent",
    color: C.dim, fontWeight: 800, fontSize: "0.98rem", cursor: "pointer", fontFamily: "inherit",
  },
  turnoTabOn: { background: C.gold, color: "#16201f", borderColor: C.gold },
  claseRow: { display: "flex", gap: 8, padding: "6px 16px 4px" },
  claseTab: {
    flex: 1, minHeight: 48, borderRadius: 12, border: `1px solid ${C.line}`, background: "transparent",
    color: C.dim, fontWeight: 700, fontSize: "0.92rem", cursor: "pointer", fontFamily: "inherit",
  },
  claseTabOn: { background: "color-mix(in srgb, #ba843c 16%, transparent)", color: C.gold, borderColor: C.border },

  chips: { display: "flex", gap: 8, overflowX: "auto", padding: "10px 16px", flexWrap: "nowrap" },
  chip: {
    minHeight: 40, padding: "0 16px", borderRadius: 999, border: `1px solid ${C.line}`, background: "transparent",
    color: C.dim, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0,
  },
  chipOn: { background: "color-mix(in srgb, #ba843c 16%, transparent)", color: C.gold, borderColor: C.border },

  grid: {
    flex: 1, overflowY: "auto", display: "grid", gap: 12, alignContent: "start",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", padding: "12px 16px 32px",
  },
  card: {
    display: "flex", flexDirection: "column", textAlign: "left", padding: 0, overflow: "hidden",
    borderRadius: 14, border: `1px solid ${C.line}`, background: C.panel, cursor: "pointer",
    fontFamily: "inherit", minHeight: 150,
  },
  cardImgWrap: { width: "100%", aspectRatio: "4 / 3", background: C.panel2, overflow: "hidden" },
  cardImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  cardText: { flex: 1, display: "flex", flexDirection: "column", gap: 6, padding: "14px 14px 6px" },
  cardTextName: { color: C.cream, fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.25 },
  cardDesc: {
    color: C.faint, fontSize: "0.76rem", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box",
    WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
  },
  cardFoot: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "10px 14px 14px" },
  cardFootName: {
    color: C.cream, fontWeight: 600, fontSize: "0.86rem", lineHeight: 1.2, overflow: "hidden",
    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
  },
  price: { color: C.gold, fontWeight: 800, fontSize: "0.9rem", marginLeft: "auto", whiteSpace: "nowrap" },

  flash: {
    position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 95,
    background: "color-mix(in srgb, #3f9d6f 16%, #1a2628)", border: `1px solid ${C.green}`, color: C.cream,
    padding: "12px 20px", borderRadius: 999, fontSize: "0.86rem", fontWeight: 600, boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
  },

  sheetScrim: { position: "fixed", inset: 0, zIndex: 96, background: "rgba(0,0,0,0.55)" },
  sheet: {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 97, background: C.panel,
    borderTop: `1px solid ${C.border}`, borderRadius: "20px 20px 0 0", padding: "10px 20px calc(20px + env(safe-area-inset-bottom))",
    maxWidth: 520, margin: "0 auto", boxShadow: "0 -18px 48px rgba(0,0,0,0.5)",
  },
  sheetGrip: { width: 40, height: 4, borderRadius: 999, background: "rgba(245,241,232,0.25)", margin: "0 auto 14px" },
  sheetName: { color: C.cream, fontWeight: 800, fontSize: "1.15rem", lineHeight: 1.2 },
  sheetPrice: { color: C.gold, fontWeight: 700, fontSize: "0.9rem", marginTop: 4 },

  quickRow: { display: "flex", gap: 8, marginBottom: 10 },
  quick: {
    flex: 1, minHeight: 44, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent",
    color: C.dim, fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", fontFamily: "inherit",
  },
  quickOn: { background: C.gold, color: "#16201f", borderColor: C.gold },
  qtyHint: { color: C.faint, fontSize: "0.72rem", textAlign: "center", marginTop: 8 },
  qtyRow: { display: "flex", alignItems: "center", gap: 16, justifyContent: "center" },
  qtyBtn: {
    width: 56, height: 56, borderRadius: 14, border: `1px solid ${C.border}`, background: "transparent",
    color: C.cream, fontSize: "1.6rem", cursor: "pointer", lineHeight: 1,
  },
  qtyVal: { color: C.cream, fontWeight: 800, fontSize: "1.9rem", minWidth: 56, textAlign: "center", fontVariantNumeric: "tabular-nums" },
};
