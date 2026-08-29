"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-client";
import { GoldSelect, type SelectOption } from "@/components/ui/GoldSelect";
import { dialogAlert, dialogConfirm } from "@/components/ui/DialogHost";

/**
 * CRUD de platillos del menú (y de "Extras"). Jerarquía: Turno (Comida/Brunch) →
 * Carta → Categoría → Platillo. La "clase" de una carta (Alimentos=COCINA /
 * Bebidas=BARRA) filtra qué cartas aplican y da el prepArea del platillo. Un extra
 * es un Dish con isExtra=true (oculto del menú público, pedible por meseros). Solo
 * ADMIN. Mismo componente para ambos apartados vía la prop `isExtra`.
 */

type Turno = "COMIDA" | "BRUNCH";
type Clase = "COCINA" | "BARRA";

interface CartaRef { id: string; name: string; turno: Turno; clase: Clase }
interface DishRow {
  id: string; name: string; description: string | null; price: number;
  imageUrl: string | null; available: boolean; active: boolean; archivedAt: string | null; isExtra: boolean;
  position: number | null; prepArea: Clase | null;
  categoryId: string; category: { id: string; name: string; cartaId: string | null; carta: CartaRef | null } | null;
  createdAt: string;
}
interface CartaRow { id: string; name: string; turno: Turno; clase: Clase; position: number | null; _count?: { categories: number } }
interface CatRow { id: string; name: string; position: number | null; cartaId: string | null }

const money = (n: number) => "$" + Number(n).toFixed(2);
const TURNO_LABEL: Record<Turno, string> = { COMIDA: "Comida", BRUNCH: "Brunch" };
const TURNO_OPTIONS: SelectOption[] = [{ value: "COMIDA", label: "Comida" }, { value: "BRUNCH", label: "Brunch" }];
const CLASE_OPTIONS: SelectOption[] = [{ value: "COCINA", label: "Alimentos (cocina)" }, { value: "BARRA", label: "Bebidas (barra)" }];
const AVAIL_FILTER: SelectOption[] = [
  { value: "", label: "Visibles y ocultos" },
  { value: "true", label: "Solo visibles en menú" },
  { value: "false", label: "Solo ocultos" },
];

async function getJson(url: string) { const r = await fetch(url, { credentials: "same-origin" }); return r.json().catch(() => null); }

export function DishCrud({ isExtra }: { isExtra: boolean }) {
  const router = useRouter();
  const session = useSession();

  const [rows, setRows] = useState<DishRow[]>([]);
  const [cartas, setCartas] = useState<CartaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartaFilter, setCartaFilter] = useState("");
  const [availFilter, setAvailFilter] = useState<"" | "true" | "false">("");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DishRow | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);

  useEffect(() => {
    if (session.loading) return;
    if (!session.user || session.user.role !== "ADMIN") router.replace("/login?mode=login");
  }, [session.loading, session.user, router]);

  const loadCartas = useCallback(async () => {
    const d = await getJson("/api/admin/menu/cartas");
    if (d?.success) setCartas(d.data as CartaRow[]);
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("isExtra", String(isExtra));
    if (cartaFilter) params.set("cartaId", cartaFilter);
    if (availFilter) params.set("available", availFilter);
    if (showDisabled) params.set("includeDisabled", "true");
    if (query.trim()) params.set("q", query.trim());
    const d = await getJson(`/api/admin/menu?${params}`);
    if (d?.success) setRows(d.data as DishRow[]);
    setLoading(false);
  }, [isExtra, cartaFilter, availFilter, showDisabled, query]);

  useEffect(() => { if (session.user?.role === "ADMIN") loadCartas(); }, [session.user, loadCartas]);
  useEffect(() => { if (session.user?.role === "ADMIN") fetchList(); }, [session.user, fetchList]);

  const toggleAvailable = async (row: DishRow) => {
    const r = await fetch(`/api/admin/menu/${row.id}`, {
      method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: !row.available }),
    });
    const d = await r.json().catch(() => null);
    if (!d?.success) void dialogAlert(d?.error ?? "Error");
    await fetchList();
  };

  // Retiro/restauración. NUNCA se borra el registro: archivar y eliminar solo apagan
  // el platillo (active=false) conservando sus ventas; archivedAt distingue la intención.
  const patchDish = async (row: DishRow, body: Record<string, unknown>) => {
    const r = await fetch(`/api/admin/menu/${row.id}`, {
      method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => null);
    if (!d?.success) { void dialogAlert(d?.error ?? "Error"); return; }
    await fetchList();
  };
  // Archivar: guardar por si acaso (restaurable de un toque). Sale de operación.
  const archiveDish = (row: DishRow) => patchDish(row, { archived: true });
  // Eliminar: retirar de la operación. No borra ventas; queda en «Eliminados», restaurable.
  const eliminarDish = async (row: DishRow) => {
    const ok = await dialogConfirm(
      `«${row.name}» se retirará de la carta y la comandera. Sus ventas históricas se conservan y puedes restaurarlo después. ¿Eliminar?`,
      { title: "Eliminar producto", confirmLabel: "Eliminar", danger: true },
    );
    if (ok) await patchDish(row, { active: false });
  };
  const restoreDish = (row: DishRow) => patchDish(row, { active: true });

  if (session.loading || !session.user || session.user.role !== "ADMIN") {
    return <div style={S.page}><p style={S.empty}>Verificando acceso…</p></div>;
  }

  const title = isExtra ? "EXTRAS" : "PRODUCTOS";
  const cartaFilterOptions: SelectOption[] = [
    { value: "", label: "Todas las cartas" },
    ...cartas.map((c) => ({ value: c.id, label: `${TURNO_LABEL[c.turno]} · ${c.name}` })),
  ];

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.h1}><span style={{ color: "#ba843c" }}>{title}</span></h1>
        <button style={S.primaryBtn} onClick={() => setCreateOpen(true)}>+ {isExtra ? "Nuevo extra" : "Nuevo producto"}</button>
      </div>

      {isExtra && (
        <p style={S.hint}>
          Los extras están <b>ocultos del menú público</b>: no aparecen en la carta, pero los meseros sí pueden pedirlos y se cobran con su precio especial (paquetes, especiales del chef).
        </p>
      )}

      {!isExtra && (
        <p style={S.hint}>
          Nada se borra: las <b>ventas históricas siempre se conservan</b>. «Oculto» solo lo quita del <b>menú público</b> (el mesero lo sigue viendo). <b>«Archivar»</b> lo guarda fuera de operación pero restaurable de un toque; <b>«Eliminar»</b> lo retira por completo (queda en «Eliminados», también restaurable).
        </p>
      )}

      <div style={S.filters}>
        <GoldSelect value={cartaFilter} onChange={setCartaFilter} options={cartaFilterOptions} placeholder="Carta" style={{ minWidth: 200 }} />
        <GoldSelect value={availFilter} onChange={(v) => setAvailFilter(v as "" | "true" | "false")} options={AVAIL_FILTER} placeholder="Visibilidad" style={{ minWidth: 180 }} />
        <input style={S.search} placeholder="Buscar producto…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchList()} />
        <label style={{ display: "flex", alignItems: "center", gap: 7, color: "rgba(245,241,232,0.72)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={showDisabled} onChange={(e) => setShowDisabled(e.target.checked)} /> Ver archivados / eliminados
        </label>
      </div>

      {loading ? <p style={S.empty}>Cargando…</p> : rows.length === 0 ? <p style={S.empty}>Sin {isExtra ? "extras" : "productos"}. Toca «+» para agregar.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead><tr>{["", "Nombre", "Turno · Carta · Categoría", "Precio", "En menú", "Acciones"].map((h, i) => <th key={i} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ opacity: !row.active ? 0.42 : row.available ? 1 : 0.62 }}>
                  <td style={S.td}><Thumb url={row.imageUrl} name={row.name} /></td>
                  <td style={S.td}>
                    <div style={{ color: "#f5f1e8", fontWeight: 600 }}>{row.name}</div>
                    {row.description && <div style={{ color: "rgba(245,241,232,0.5)", fontSize: "0.74rem", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.description}</div>}
                  </td>
                  <td style={{ ...S.td, color: "rgba(245,241,232,0.72)", fontSize: "0.8rem" }}>
                    {row.category?.carta ? `${TURNO_LABEL[row.category.carta.turno]} · ${row.category.carta.name} · ` : ""}{row.category?.name ?? "—"}
                  </td>
                  <td style={{ ...S.td, color: "#f5f1e8", fontWeight: 700, whiteSpace: "nowrap" }}>{money(row.price)}</td>
                  <td style={S.td}>
                    {row.active
                      ? <Switch on={row.available} onClick={() => toggleAvailable(row)} labelOn="Mostrar" labelOff="Oculto" />
                      : row.archivedAt
                        ? <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#c9a24a", border: "1px solid rgba(201,162,74,0.5)", borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>Archivado</span>
                        : <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#e8766b", border: "1px solid rgba(232,118,107,0.5)", borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>Eliminado</span>}
                  </td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {row.active ? (
                        <>
                          <button style={S.miniBtn} onClick={() => setEditTarget(row)}>Editar</button>
                          <button style={{ ...S.miniBtn, borderColor: "rgba(201,162,74,0.35)", color: "#c9a24a" }} onClick={() => archiveDish(row)}>Archivar</button>
                          <button style={{ ...S.miniBtn, borderColor: "rgba(232,118,107,0.4)", color: "#e8766b" }} onClick={() => eliminarDish(row)}>Eliminar</button>
                        </>
                      ) : row.archivedAt ? (
                        <>
                          <button style={S.miniBtn} onClick={() => restoreDish(row)}>Restaurar</button>
                          <button style={{ ...S.miniBtn, borderColor: "rgba(232,118,107,0.4)", color: "#e8766b" }} onClick={() => eliminarDish(row)}>Eliminar</button>
                        </>
                      ) : (
                        <button style={S.miniBtn} onClick={() => restoreDish(row)}>Restaurar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && <DishFormModal mode="create" isExtra={isExtra} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); loadCartas(); fetchList(); }} />}
      {editTarget && <DishFormModal mode="edit" isExtra={isExtra} row={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); loadCartas(); fetchList(); }} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────── Form modal ──
export function DishFormModal({ mode, isExtra, row, preset, onClose, onSaved }: {
  mode: "create" | "edit"; isExtra: boolean; row?: DishRow;
  preset?: { turno?: string; clase?: string; cartaId?: string; categoryId?: string };
  onClose: () => void; onSaved: () => void;
}) {
  const c0 = row?.category?.carta ?? null;
  const [turno, setTurno] = useState<string>(c0?.turno ?? preset?.turno ?? "");
  const [clase, setClase] = useState<string>(c0?.clase ?? preset?.clase ?? "");
  const [cartaId, setCartaId] = useState(c0?.id ?? preset?.cartaId ?? "");
  const [categoryId, setCategoryId] = useState(row?.categoryId ?? preset?.categoryId ?? "");
  const [name, setName] = useState(row?.name ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [price, setPrice] = useState(row ? String(row.price) : "");
  const [imageUrl, setImageUrl] = useState(row?.imageUrl ?? "");
  const [available, setAvailable] = useState(row ? row.available : !isExtra); // extras nacen ocultos

  const [cartas, setCartas] = useState<CartaRow[]>([]);
  const [cats, setCats] = useState<CatRow[]>([]);
  const [newCarta, setNewCarta] = useState("");
  const [newCat, setNewCat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    setUploading(true); setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/admin/menu/upload", { method: "POST", credentials: "same-origin", body: fd });
    const d = await r.json().catch(() => null);
    setUploading(false);
    if (d?.success) setImageUrl(d.data.path);
    else setError(d?.error ?? "No se pudo subir la imagen");
  };

  // Cartas disponibles según turno + clase.
  useEffect(() => {
    if (turno !== "COMIDA" && turno !== "BRUNCH") { setCartas([]); return; }
    if (clase !== "COCINA" && clase !== "BARRA") { setCartas([]); return; }
    getJson(`/api/admin/menu/cartas?turno=${turno}&clase=${clase}`).then((d) => { if (d?.success) setCartas(d.data as CartaRow[]); });
  }, [turno, clase]);

  // Categorías de la carta elegida.
  useEffect(() => {
    if (!cartaId) { setCats([]); return; }
    getJson(`/api/admin/menu/categories?cartaId=${cartaId}`).then((d) => { if (d?.success) setCats(d.data as CatRow[]); });
  }, [cartaId]);

  const priceNum = Number(price);
  const canSave = name.trim().length > 0 && categoryId && Number.isFinite(priceNum) && priceNum >= 0 && !saving;

  const createCarta = async () => {
    if (!newCarta.trim() || turno === "" || clase === "") { setError("Elige turno y área antes de crear una carta"); return; }
    const r = await fetch("/api/admin/menu/cartas", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCarta.trim(), turno, clase }),
    });
    const d = await r.json().catch(() => null);
    if (d?.success) { setNewCarta(""); const nd = await getJson(`/api/admin/menu/cartas?turno=${turno}&clase=${clase}`); if (nd?.success) setCartas(nd.data as CartaRow[]); setCartaId(d.data.id); setCategoryId(""); }
    else setError(d?.error ?? "No se pudo crear la carta");
  };

  const createCategory = async () => {
    if (!newCat.trim() || !cartaId) { setError("Elige una carta antes de crear una categoría"); return; }
    const r = await fetch("/api/admin/menu/categories", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCat.trim(), cartaId }),
    });
    const d = await r.json().catch(() => null);
    if (d?.success) { setNewCat(""); const nd = await getJson(`/api/admin/menu/categories?cartaId=${cartaId}`); if (nd?.success) setCats(nd.data as CatRow[]); setCategoryId(d.data.id); }
    else setError(d?.error ?? "No se pudo crear la categoría");
  };

  const submit = async () => {
    setSaving(true); setError(null);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      price: priceNum,
      imageUrl: imageUrl.trim() || null,
      categoryId,
      prepArea: clase || null, // el área del platillo = la clase de su carta
      available,
      isExtra,
    };
    const url = mode === "create" ? "/api/admin/menu" : `/api/admin/menu/${row!.id}`;
    const r = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => null);
    if (d?.success) onSaved();
    else { setError(d?.error ?? "Error al guardar"); setSaving(false); }
  };

  const claseReady = turno !== "" && clase !== "";
  const cartaOptions: SelectOption[] = cartas.map((c) => ({ value: c.id, label: c.name }));
  const catOptions: SelectOption[] = cats.map((c) => ({ value: c.id, label: c.name }));

  return (
    <Overlay onClose={onClose}>
      <p style={S.kicker}>{mode === "create" ? (isExtra ? "Nuevo extra" : "Nuevo producto") : "Editar"}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        {/* Cascada: Turno → Área → Carta → Categoría */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={S.label}>1 · Turno</label>
            <GoldSelect value={turno} onChange={(v) => { setTurno(v); setCartaId(""); setCategoryId(""); }} options={TURNO_OPTIONS} placeholder="Comida / Brunch" />
          </div>
          <div>
            <label style={S.label}>2 · Área</label>
            <GoldSelect value={clase} onChange={(v) => { setClase(v); setCartaId(""); setCategoryId(""); }} options={CLASE_OPTIONS} placeholder="Alimentos / Bebidas" />
          </div>
        </div>

        {claseReady && (
          <div>
            <label style={S.label}>3 · Carta</label>
            <GoldSelect value={cartaId} onChange={(v) => { setCartaId(v); setCategoryId(""); }} options={cartaOptions} placeholder={cartaOptions.length ? "Elige carta" : "Sin cartas — crea una"} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input style={{ ...S.input, flex: 1 }} value={newCarta} onChange={(e) => setNewCarta(e.target.value)} placeholder="…o crea una carta nueva" />
              <button style={S.ghostBtnAuto} onClick={createCarta} disabled={!newCarta.trim()}>Crear</button>
            </div>
          </div>
        )}

        {cartaId && (
          <div>
            <label style={S.label}>4 · Categoría</label>
            <GoldSelect value={categoryId} onChange={setCategoryId} options={catOptions} placeholder={catOptions.length ? "Elige categoría" : "Sin categorías — crea una"} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input style={{ ...S.input, flex: 1 }} value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="…o crea una categoría nueva" />
              <button style={S.ghostBtnAuto} onClick={createCategory} disabled={!newCat.trim()}>Crear</button>
            </div>
          </div>
        )}

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "2px 0" }} />

        <div>
          <label style={S.label}>Nombre del producto</label>
          <input style={S.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Risotto de trufa" />
        </div>
        <div>
          <label style={S.label}>Descripción (opcional)</label>
          <textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descripción" />
        </div>
        <div>
          <label style={S.label}>Precio (MXN)</label>
          <input style={S.input} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" />
        </div>
        <div>
          <label style={S.label}>Imagen (opcional)</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,0.15)" }} />
            )}
            <input style={{ ...S.input, flex: 1 }} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Sube una imagen o pega una ruta/URL" />
            <button type="button" style={S.ghostBtnAuto} onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? "Subiendo…" : "Subir"}</button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: "none" }} onChange={handleFile} />
          </div>
          <p style={{ color: "rgba(245,241,232,0.5)", fontSize: "0.72rem", margin: "6px 0 0" }}>PNG, JPG, WEBP o GIF (máx 5 MB). Se guarda en el servidor.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 2px" }}>
          <span style={{ color: "rgba(245,241,232,0.8)", fontSize: "0.85rem" }}>Mostrar en el menú público</span>
          <Switch on={available} onClick={() => setAvailable((v) => !v)} labelOn="Mostrar" labelOff="Oculto" />
        </div>
        {error && <p style={{ color: "#e8766b", fontSize: "0.82rem", margin: 0 }}>⚠ {error}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button style={S.ghostBtn} onClick={onClose}>Cancelar</button>
          <button style={{ ...S.primaryBtn, flex: 1, opacity: canSave ? 1 : 0.5 }} onClick={submit} disabled={!canSave}>{saving ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}</button>
        </div>
      </div>
    </Overlay>
  );
}

function Thumb({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const box: React.CSSProperties = { width: 42, height: 42, borderRadius: 8, objectFit: "cover", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(245,241,232,0.5)", fontWeight: 800, fontSize: "0.9rem", flexShrink: 0 };
  if (!url || failed) return <div style={box}>{name.slice(0, 1).toUpperCase()}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={name} style={box} onError={() => setFailed(true)} />;
}

function Switch({ on, onClick, labelOn, labelOff }: { on: boolean; onClick: () => void; labelOn: string; labelOff: string }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
      <span style={{ width: 40, height: 22, borderRadius: 999, background: on ? "#ba843c" : "rgba(255,255,255,0.15)", position: "relative", transition: "background .15s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: 999, background: "#f5f1e8", transition: "left .15s" }} />
      </span>
      <span style={{ fontSize: "0.75rem", color: on ? "#c9964a" : "rgba(245,241,232,0.55)", fontWeight: 600 }}>{on ? labelOn : labelOff}</span>
    </button>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#1a2628", border: "1px solid rgba(186,132,60,0.25)", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "calc(100vh - 32px)", overflowY: "auto", padding: "26px 24px" }}>{children}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#16201f", padding: "0 0 40px", color: "#f5f1e8", fontFamily: "inherit" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "20px 20px 0", margin: "0 0 14px" },
  h1: { fontSize: "1.1rem", fontWeight: 800, letterSpacing: "0.08em", margin: 0 },
  hint: { color: "rgba(245,241,232,0.66)", fontSize: "0.82rem", lineHeight: 1.5, padding: "0 20px", margin: "0 0 14px", maxWidth: 720 },
  filters: { display: "flex", gap: 10, flexWrap: "wrap", padding: "0 20px", marginBottom: 18 },
  search: { flex: 1, minWidth: 200, padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "#f5f1e8", fontSize: "0.82rem", fontFamily: "inherit" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" },
  th: { textAlign: "left", padding: "10px 20px", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,241,232,0.58)", borderBottom: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap" },
  td: { padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", verticalAlign: "middle" },
  empty: { textAlign: "center", color: "rgba(245,241,232,0.62)", marginTop: 60 },
  primaryBtn: { padding: "12px 18px", minHeight: 44, borderRadius: 9, border: "none", background: "#ba843c", color: "#16201f", fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.04em", cursor: "pointer", fontFamily: "inherit" },
  ghostBtn: { flex: 1, padding: "12px 0", minHeight: 44, borderRadius: 9, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "rgba(245,241,232,0.72)", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" },
  ghostBtnAuto: { padding: "0 16px", minHeight: 44, borderRadius: 9, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "rgba(245,241,232,0.72)", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  miniBtn: { padding: "9px 14px", minHeight: 40, borderRadius: 8, border: "1px solid rgba(186,132,60,0.5)", background: "transparent", color: "#c9964a", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  kicker: { fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9964a", fontWeight: 700, margin: 0 },
  label: { display: "block", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,241,232,0.62)", fontWeight: 700, marginBottom: 5 },
  input: { width: "100%", padding: "12px 13px", minHeight: 44, borderRadius: 9, boxSizing: "border-box", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: "#f5f1e8", fontSize: "0.9rem", fontFamily: "inherit" },
};
