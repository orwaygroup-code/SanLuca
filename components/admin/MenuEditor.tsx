"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DishFormModal } from "@/components/admin/DishCrud";

/**
 * Editor de Menú (rediseño tipo tarjetas): Turno → Cartas (tarjetas) → Categorías
 * desplegables con platillos inline. Reusa DishFormModal para alta/edición de platillo.
 * Cablea el CRUD nuevo de cartas/categorías (PATCH/DELETE, principal, ocultar). Solo ADMIN.
 */

type Turno = "COMIDA" | "BRUNCH";
type Clase = "COCINA" | "BARRA";
interface CartaRef { id: string; name: string; turno: Turno; clase: Clase }
interface Carta { id: string; name: string; turno: Turno; clase: Clase; position: number | null; isPrincipal: boolean; _count?: { categories: number } }
interface Cat { id: string; name: string; position: number | null; visible: boolean; cartaId: string | null; _count?: { dishes: number } }
interface Dish {
  id: string; name: string; description: string | null; price: number; imageUrl: string | null;
  available: boolean; active: boolean; isExtra: boolean; position: number | null; prepArea: Clase | null;
  categoryId: string; category: { id: string; name: string; cartaId: string | null; carta: CartaRef | null } | null; createdAt: string;
}

const GOLD = "#ba843c";
const money = (n: number) => "$" + Number(n).toFixed(2);
const TURNO_LABEL: Record<Turno, string> = { COMIDA: "Comida", BRUNCH: "Brunch" };
const CLASE_LABEL: Record<Clase, string> = { COCINA: "Alimentos", BARRA: "Bebidas" };

async function getJson(url: string) { const r = await fetch(url, { credentials: "same-origin" }); return r.json().catch(() => null); }
async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return r.json().catch(() => null);
}

export function MenuEditor() {
  const [turno, setTurno] = useState<Turno>("COMIDA");
  const [cartas, setCartas] = useState<Carta[]>([]);
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [selCarta, setSelCarta] = useState<string>("");
  const [cats, setCats] = useState<Cat[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [dishForm, setDishForm] = useState<{ mode: "create" | "edit"; row?: Dish; preset?: { turno?: string; clase?: string; cartaId?: string; categoryId?: string } } | null>(null);
  const [nameModal, setNameModal] = useState<null | { kind: "new-carta" | "rename-carta" | "new-cat" | "rename-cat"; id?: string; initial?: string; clase?: Clase }>(null);
  const [confirmDel, setConfirmDel] = useState<null | { kind: "carta" | "cat"; id: string; name: string }>(null);

  const loadCartas = useCallback(async () => { const d = await getJson(`/api/admin/menu/cartas?turno=${turno}`); if (d?.success) setCartas(d.data as Carta[]); }, [turno]);
  const loadDishes = useCallback(async () => { const d = await getJson(`/api/admin/menu?isExtra=false`); if (d?.success) setAllDishes(d.data as Dish[]); }, []);
  const loadCats = useCallback(async (cartaId: string) => { const d = await getJson(`/api/admin/menu/categories?cartaId=${cartaId}`); if (d?.success) setCats(d.data as Cat[]); }, []);

  useEffect(() => { setLoading(true); Promise.all([loadCartas(), loadDishes()]).finally(() => setLoading(false)); }, [loadCartas, loadDishes]);
  useEffect(() => { setSelCarta(""); setExpanded(null); }, [turno]);
  useEffect(() => { if (selCarta) loadCats(selCarta); else setCats([]); }, [selCarta, loadCats]);

  const itemCountByCarta = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of allDishes) { const cid = d.category?.cartaId; if (cid) m.set(cid, (m.get(cid) ?? 0) + 1); }
    return m;
  }, [allDishes]);
  const dishesByCat = useMemo(() => {
    const m = new Map<string, Dish[]>();
    for (const d of allDishes) { const arr = m.get(d.categoryId); if (arr) arr.push(d); else m.set(d.categoryId, [d]); }
    return m;
  }, [allDishes]);

  const selCartaObj = cartas.find((c) => c.id === selCarta) ?? null;

  const patchCarta = async (id: string, body: unknown) => { const d = await send(`/api/admin/menu/cartas/${id}`, "PATCH", body); if (d?.success) loadCartas(); else setErr(d?.error ?? "No se pudo actualizar la carta"); };
  const patchCat = async (id: string, body: unknown) => { const d = await send(`/api/admin/menu/categories/${id}`, "PATCH", body); if (d?.success) loadCats(selCarta); else setErr(d?.error ?? "No se pudo actualizar la categoría"); };

  const doDelete = async () => {
    if (!confirmDel) return;
    const url = confirmDel.kind === "carta" ? `/api/admin/menu/cartas/${confirmDel.id}` : `/api/admin/menu/categories/${confirmDel.id}`;
    const d = await send(url, "DELETE");
    if (d?.success) { if (confirmDel.kind === "carta") { setSelCarta(""); loadCartas(); } else loadCats(selCarta); setConfirmDel(null); }
    else setErr(d?.error ?? "No se pudo eliminar");
  };

  const saveName = async (name: string, clase?: Clase) => {
    if (!nameModal) return;
    let d: { success?: boolean; error?: string } | null = null;
    if (nameModal.kind === "new-carta") d = await send(`/api/admin/menu/cartas`, "POST", { name, turno, clase });
    else if (nameModal.kind === "rename-carta") d = await send(`/api/admin/menu/cartas/${nameModal.id}`, "PATCH", { name });
    else if (nameModal.kind === "new-cat") d = await send(`/api/admin/menu/categories`, "POST", { name, cartaId: selCarta });
    else if (nameModal.kind === "rename-cat") d = await send(`/api/admin/menu/categories/${nameModal.id}`, "PATCH", { name });
    if (d?.success) { setNameModal(null); await Promise.all([loadCartas(), selCarta ? loadCats(selCarta) : Promise.resolve()]); }
    else setErr(d?.error ?? "No se pudo guardar");
  };

  const afterDishSaved = async () => { setDishForm(null); await Promise.all([loadDishes(), loadCartas(), selCarta ? loadCats(selCarta) : Promise.resolve()]); };

  return (
    <div style={X.page}>
      <div style={X.head}>
        <div>
          <h1 style={X.h1}><span style={{ color: GOLD }}>Editor de Menú</span></h1>
          <p style={X.sub}>Gestione sus cartas, categorías y platillos activos.</p>
        </div>
        <div style={X.turnoToggle}>
          {(["COMIDA", "BRUNCH"] as const).map((t) => (
            <button key={t} onClick={() => setTurno(t)} style={{ ...X.turnoBtn, ...(turno === t ? X.turnoOn : {}) }}>{TURNO_LABEL[t].toUpperCase()}</button>
          ))}
        </div>
      </div>

      {err && <div style={X.err} onClick={() => setErr(null)}>⚠ {err} <span style={{ opacity: 0.6 }}>(toca para cerrar)</span></div>}

      {/* Cartas activas */}
      <div style={X.sectionTitle}>🍽 Cartas Activas</div>
      {loading ? <p style={X.muted}>Cargando…</p> : (
        <div style={X.cardGrid}>
          {cartas.map((c) => {
            const on = c.id === selCarta;
            return (
              <button key={c.id} onClick={() => { setSelCarta(on ? "" : c.id); setExpanded(null); }} style={{ ...X.card, ...(on ? X.cardOn : {}) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ fontSize: "1.2rem" }}>{c.clase === "BARRA" ? "🍷" : "🍴"}</span>
                  {c.isPrincipal && <span style={X.principalTag}>★ Principal</span>}
                </div>
                <div style={X.cardName}>{c.name}</div>
                <div style={X.cardMeta}>{c._count?.categories ?? 0} Categorías · {itemCountByCarta.get(c.id) ?? 0} Items</div>
              </button>
            );
          })}
          <button onClick={() => setNameModal({ kind: "new-carta", clase: "COCINA" })} style={{ ...X.card, ...X.cardAdd }}>+ Nueva carta</button>
        </div>
      )}

      {/* Categorías de la carta seleccionada */}
      {selCartaObj && (
        <div style={{ marginTop: 26 }}>
          <div style={X.crumb}>
            Turno {TURNO_LABEL[turno]} <span style={{ opacity: 0.5 }}>›</span> Carta {selCartaObj.name}
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button style={X.mini} onClick={() => patchCarta(selCartaObj.id, { isPrincipal: !selCartaObj.isPrincipal })}>{selCartaObj.isPrincipal ? "Quitar principal" : "★ Marcar principal"}</button>
              <button style={X.mini} onClick={() => setNameModal({ kind: "rename-carta", id: selCartaObj.id, initial: selCartaObj.name })}>Renombrar</button>
              <button style={X.miniDanger} onClick={() => setConfirmDel({ kind: "carta", id: selCartaObj.id, name: selCartaObj.name })}>Eliminar</button>
            </span>
          </div>

          <div style={X.catHead}>
            <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#f5f1e8" }}>Categorías</span>
            <button style={X.primary} onClick={() => setNameModal({ kind: "new-cat", initial: "" })}>+ Nueva Categoría</button>
          </div>

          {cats.length === 0 ? <p style={X.muted}>Sin categorías. Crea la primera.</p> : cats.map((cat) => {
            const isOpen = expanded === cat.id;
            const catDishes = dishesByCat.get(cat.id) ?? [];
            return (
              <div key={cat.id} style={X.catCard}>
                <div style={X.catRow}>
                  <button onClick={() => setExpanded(isOpen ? null : cat.id)} style={X.catToggle}>
                    <span style={{ fontSize: "1.05rem" }}>🍴</span>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <span style={{ fontWeight: 800, color: "#f5f1e8", fontSize: "0.98rem" }}>{cat.name}</span>
                      <span style={{ fontSize: "0.74rem", color: "rgba(245,241,232,0.55)" }}>{catDishes.length} Items · {cat.visible ? "Visible" : "Oculta"}</span>
                    </span>
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button style={X.iconBtn} title="Renombrar" onClick={() => setNameModal({ kind: "rename-cat", id: cat.id, initial: cat.name })}>✎</button>
                    <button style={X.iconBtn} title={cat.visible ? "Ocultar del menú público" : "Mostrar en el menú público"} onClick={() => patchCat(cat.id, { visible: !cat.visible })}>{cat.visible ? "👁" : "🚫"}</button>
                    <button style={X.iconBtnDanger} title="Eliminar categoría" onClick={() => setConfirmDel({ kind: "cat", id: cat.id, name: cat.name })}>🗑</button>
                    <button style={X.iconBtn} onClick={() => setExpanded(isOpen ? null : cat.id)}>{isOpen ? "▲" : "▼"}</button>
                  </div>
                </div>
                {isOpen && (
                  <div style={X.dishRow}>
                    {catDishes.map((dsh) => (
                      <button key={dsh.id} style={X.dishChip} onClick={() => setDishForm({ mode: "edit", row: dsh })}>
                        <Thumb url={dsh.imageUrl} name={dsh.name} />
                        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                          <span style={{ color: "#f5f1e8", fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>{dsh.name}</span>
                          <span style={{ color: GOLD, fontSize: "0.72rem" }}>{money(dsh.price)}</span>
                        </span>
                      </button>
                    ))}
                    <button style={X.addDish} onClick={() => setDishForm({ mode: "create", preset: { turno, clase: selCartaObj.clase, cartaId: selCartaObj.id, categoryId: cat.id } })}>+ Añadir Plato</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {dishForm && (
        <DishFormModal
          mode={dishForm.mode}
          isExtra={false}
          row={dishForm.row as never}
          preset={dishForm.preset}
          onClose={() => setDishForm(null)}
          onSaved={afterDishSaved}
        />
      )}
      {nameModal && (
        <NameModal
          title={nameModal.kind.startsWith("new") ? (nameModal.kind === "new-carta" ? "Nueva carta" : "Nueva categoría") : "Renombrar"}
          initial={nameModal.initial ?? ""}
          withClase={nameModal.kind === "new-carta"}
          onClose={() => setNameModal(null)}
          onSave={saveName}
        />
      )}
      {confirmDel && (
        <Confirm
          title={`Eliminar ${confirmDel.kind === "carta" ? "carta" : "categoría"}`}
          message={`¿Eliminar «${confirmDel.name}»? Solo se puede si está vacía.`}
          onClose={() => setConfirmDel(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}

function Thumb({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const box: React.CSSProperties = { width: 34, height: 34, borderRadius: 7, objectFit: "cover", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(245,241,232,0.5)", fontWeight: 800, fontSize: "0.8rem", flexShrink: 0 };
  if (!url || failed) return <div style={box}>{name.slice(0, 1).toUpperCase()}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={name} style={box} onError={() => setFailed(true)} />;
}

function NameModal({ title, initial, withClase, onClose, onSave }: {
  title: string; initial: string; withClase: boolean; onClose: () => void; onSave: (name: string, clase?: Clase) => void;
}) {
  const [name, setName] = useState(initial);
  const [clase, setClase] = useState<Clase>("COCINA");
  return (
    <Overlay onClose={onClose}>
      <p style={X.kicker}>{title}</p>
      <input autoFocus style={X.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSave(name.trim(), withClase ? clase : undefined); }} />
      {withClase && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {(["COCINA", "BARRA"] as const).map((cl) => (
            <button key={cl} onClick={() => setClase(cl)} style={{ ...X.claseChip, ...(clase === cl ? X.claseOn : {}) }}>{CLASE_LABEL[cl]}</button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button style={X.ghost} onClick={onClose}>Cancelar</button>
        <button style={{ ...X.primary, flex: 1, opacity: name.trim() ? 1 : 0.5 }} disabled={!name.trim()} onClick={() => onSave(name.trim(), withClase ? clase : undefined)}>Guardar</button>
      </div>
    </Overlay>
  );
}

function Confirm({ title, message, onClose, onConfirm }: { title: string; message: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <p style={X.kicker}>{title}</p>
      <p style={{ color: "rgba(245,241,232,0.82)", fontSize: "0.9rem", lineHeight: 1.5, margin: "8px 0 0" }}>{message}</p>
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button style={X.ghost} onClick={onClose}>Cancelar</button>
        <button style={{ ...X.primary, flex: 1, background: "#e8766b", color: "#16201f" }} onClick={onConfirm}>Eliminar</button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#1a2628", border: "1px solid rgba(186,132,60,0.25)", borderRadius: 16, width: "100%", maxWidth: 420, padding: "26px 24px" }}>{children}</div>
    </div>
  );
}

const X: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#16201f", padding: "20px 20px 60px", color: "#f5f1e8", fontFamily: "inherit" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 22 },
  h1: { fontSize: "1.6rem", fontWeight: 800, margin: 0 },
  sub: { color: "rgba(245,241,232,0.6)", fontSize: "0.86rem", margin: "4px 0 0" },
  turnoToggle: { display: "inline-flex", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, overflow: "hidden" },
  turnoBtn: { padding: "9px 18px", background: "transparent", border: "none", color: "rgba(245,241,232,0.6)", fontWeight: 800, fontSize: "0.76rem", letterSpacing: "0.08em", cursor: "pointer", fontFamily: "inherit" },
  turnoOn: { background: GOLD, color: "#16201f" },
  err: { background: "rgba(232,118,107,0.12)", border: "1px solid rgba(232,118,107,0.4)", color: "#e8766b", borderRadius: 10, padding: "10px 14px", fontSize: "0.84rem", marginBottom: 16, cursor: "pointer" },
  sectionTitle: { color: GOLD, fontWeight: 800, fontSize: "1.05rem", marginBottom: 14 },
  muted: { color: "rgba(245,241,232,0.55)", fontSize: "0.86rem" },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 },
  card: { textAlign: "left", display: "flex", flexDirection: "column", gap: 10, padding: "16px 18px", minHeight: 118, borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "#1a2628", color: "#f5f1e8", cursor: "pointer", fontFamily: "inherit" },
  cardOn: { border: `1.5px solid ${GOLD}`, boxShadow: "0 0 0 3px rgba(186,132,60,0.12)" },
  cardAdd: { alignItems: "center", justifyContent: "center", color: GOLD, fontWeight: 800, fontSize: "0.9rem", borderStyle: "dashed" },
  cardName: { fontSize: "1.15rem", fontWeight: 800 },
  cardMeta: { color: "rgba(245,241,232,0.55)", fontSize: "0.78rem" },
  principalTag: { fontSize: "0.62rem", fontWeight: 800, color: GOLD, background: "rgba(186,132,60,0.14)", border: `1px solid ${GOLD}`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" },
  crumb: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: "rgba(245,241,232,0.7)", fontSize: "0.84rem", marginBottom: 14 },
  catHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 },
  catCard: { background: "#1a2628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, marginBottom: 10, overflow: "hidden" },
  catRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px" },
  catToggle: { display: "flex", alignItems: "center", gap: 12, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", flex: 1, minWidth: 0, textAlign: "left" },
  dishRow: { display: "flex", flexWrap: "wrap", gap: 10, padding: "0 14px 14px" },
  dishChip: { display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 6px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", cursor: "pointer", fontFamily: "inherit" },
  addDish: { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: `1px dashed ${GOLD}`, background: "transparent", color: GOLD, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" },
  iconBtn: { width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(245,241,232,0.75)", cursor: "pointer", fontSize: "0.85rem", flexShrink: 0 },
  iconBtnDanger: { width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(232,118,107,0.45)", background: "transparent", color: "#e8766b", cursor: "pointer", fontSize: "0.85rem", flexShrink: 0 },
  mini: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(186,132,60,0.5)", background: "transparent", color: "#c9964a", fontSize: "0.74rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  miniDanger: { padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(232,118,107,0.45)", background: "transparent", color: "#e8766b", fontSize: "0.74rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  primary: { padding: "10px 16px", minHeight: 40, borderRadius: 9, border: "none", background: GOLD, color: "#16201f", fontWeight: 800, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" },
  ghost: { padding: "10px 16px", minHeight: 40, borderRadius: 9, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "rgba(245,241,232,0.72)", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" },
  kicker: { fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9964a", fontWeight: 700, margin: 0 },
  input: { width: "100%", padding: "12px 13px", minHeight: 44, borderRadius: 9, boxSizing: "border-box", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: "#f5f1e8", fontSize: "0.9rem", fontFamily: "inherit", marginTop: 10 },
  claseChip: { flex: 1, padding: "10px 0", borderRadius: 9, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "rgba(245,241,232,0.72)", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" },
  claseOn: { background: GOLD, color: "#16201f", borderColor: GOLD },
};
