"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { C, Modal, Spinner, EmptyState, Badge, btn, fld, usePoll, type ToastKind } from "@/components/staff/ui";
import { apiFetch } from "@/components/staff/types";

/**
 * Almacén (Ola A-3). Consume el backend de A-1/A-2. NINGÚN campo de stock en los
 * formularios: el stock solo se mueve con movimientos. Cuatro pantallas del artefacto:
 * lista, hoja de movimiento, historial y ajuste, más el modo administración (MANAGER).
 */

type Push = (message: string, kind?: ToastKind) => void;
type Role = string;
const UNITS = ["PIEZA", "KG", "GRAMO", "LITRO", "ML", "CAJA", "PAQUETE"] as const;

interface AlmItem {
  id: number; categoryId: number; name: string; unit: string;
  stock: number; minStock: number | null; lastCost: number | null;
  notes: string | null; position: number | null; active: boolean; archivedAt: string | null; low: boolean;
}
interface AlmCatWithItems { id: number; name: string; position: number | null; active: boolean; archivedAt: string | null; items: AlmItem[] }
interface AlmCat { id: number; name: string; position: number | null; active: boolean; archivedAt: string | null; itemCount: number }
interface Movement {
  id: number; type: "ENTRADA" | "SALIDA" | "MERMA" | "AJUSTE";
  quantity: number; balanceAfter: number; unitCost: number | null; supplier: string | null;
  reason: string | null; createdAt: string; createdBy: { fullName: string };
}

const MX_TZ = "America/Mexico_City";
const fmtWhen = (iso: string) => new Intl.DateTimeFormat("es-MX", { timeZone: MX_TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
/** Cantidad legible: 3 decimales sin ceros de cola (9.9, 12.4, 3). */
const fmtQ = (n: number) => String(Math.round(n * 1000) / 1000);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const MOVE_META: Record<Movement["type"], { label: string; color: string; sign: string }> = {
  ENTRADA: { label: "Entrada", color: C.green, sign: "+" },
  SALIDA: { label: "Salida", color: C.amber, sign: "−" },
  MERMA: { label: "Merma", color: C.red, sign: "−" },
  AJUSTE: { label: "Ajuste", color: C.gold, sign: "=" },
};

// ── Teclado numérico de 12 teclas (compartido por movimiento y ajuste) ──
function applyKey(v: string, k: string): string {
  if (k === "⌫") return v.slice(0, -1);
  if (k === ".") return v.includes(".") ? v : v === "" ? "0." : v + ".";
  const next = (v === "0" ? "" : v) + k;
  const dot = next.split(".");
  if (dot[1] && dot[1].length > 3) return v; // máx 3 decimales (Decimal(12,3))
  return next;
}
function Keypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => (
        <button key={k} onClick={() => onKey(k)} style={kpKey}>{k}</button>
      ))}
    </div>
  );
}

// ═══════════════════════════════ VISTA PRINCIPAL ═══════════════════════════════

export function AlmacenView({ role, push, adminMode }: { role: Role; push: Push; adminMode: boolean }) {
  const [cats, setCats] = useState<AlmCatWithItems[] | null>(null);
  const [catList, setCatList] = useState<AlmCat[]>([]);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<number | "all">("all");
  const [move, setMove] = useState<{ item: AlmItem; kind: "ENTRADA" | "SALIDA" } | null>(null);
  const [history, setHistory] = useState<AlmItem | null>(null);
  const [adjust, setAdjust] = useState<AlmItem | null>(null);
  const [catModal, setCatModal] = useState<{ cat: AlmCat | null } | null>(null);
  const [itemModal, setItemModal] = useState<{ item: AlmItem | null } | null>(null);

  const isManager = role === "MANAGER";
  const canMerma = role === "KITCHEN" || role === "CAPTAIN" || role === "MANAGER";

  const load = useCallback(async () => {
    const inc = adminMode ? "?includeArchived=1" : "";
    const [ri, rc] = await Promise.all([
      apiFetch<AlmCatWithItems[]>(`/api/almacen/items${inc}`),
      apiFetch<AlmCat[]>(`/api/almacen/categories${inc}`),
    ]);
    if (ri.ok) setCats(ri.data ?? []);
    else { setCats([]); push(ri.error ?? "No se pudo cargar el almacén", "error"); }
    if (rc.ok) setCatList(rc.data ?? []);
  }, [adminMode, push]);

  useEffect(() => { load(); }, [load]);

  const anyOpen = !!move || !!history || !!adjust || !!catModal || !!itemModal;
  usePoll(load, 15000, !anyOpen); // en vivo cada 15 s; se pausa mientras hay una hoja abierta (no interrumpe la captura)

  const allItems = useMemo(
    () => (cats ?? []).flatMap((c) => c.items.map((it) => ({ ...it, categoryName: c.name }))),
    [cats],
  );
  const chips = useMemo(
    () => (cats ?? []).filter((c) => c.items.length > 0).map((c) => ({ id: c.id, name: c.name })),
    [cats],
  );
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allItems.filter((it) =>
      (catFilter === "all" || it.categoryId === catFilter) &&
      (needle === "" || it.name.toLowerCase().includes(needle)),
    );
  }, [allItems, q, catFilter]);

  const refresh = useCallback(() => { load(); }, [load]);
  const activeCats = catList.filter((c) => c.active);

  if (cats === null) return <Spinner label="Cargando almacén…" />;

  return (
    <div>
      {/* Modo administración: acciones y gestión de categorías (MANAGER) */}
      {adminMode && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button style={btn.primary} onClick={() => setCatModal({ cat: null })}>Nueva categoría</button>
            <button style={btn.primary} onClick={() => setItemModal({ item: null })}>Nuevo producto</button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {catList.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatModal({ cat: c })}
                style={{ ...chipStyle, opacity: c.active ? 1 : 0.5 }}
                title="Editar categoría"
              >
                {c.name} · {c.itemCount}{c.active ? "" : " · archivada"} ✎
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Buscador */}
      <input
        style={{ ...fld.input, marginBottom: 10 }}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar producto…"
        aria-label="Buscar producto"
      />

      {/* Chips de categoría */}
      {chips.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
          <button onClick={() => setCatFilter("all")} style={{ ...chipStyle, ...(catFilter === "all" ? chipOn : {}) }}>Todos</button>
          {chips.map((c) => (
            <button key={c.id} onClick={() => setCatFilter(c.id)} style={{ ...chipStyle, ...(catFilter === c.id ? chipOn : {}) }}>{c.name}</button>
          ))}
        </div>
      )}

      {/* Lista de productos */}
      {shown.length === 0 ? (
        <EmptyState text={
          allItems.length === 0
            ? (isManager ? "Aún no hay productos. Toca «Administrar» y crea el primero." : "El manager aún no ha cargado el catálogo del almacén.")
            : "Sin resultados para tu búsqueda."
        } />
      ) : (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {shown.map((it) => (
            <div key={it.id} style={{ ...card, ...(it.low ? { borderColor: C.red } : {}), ...(it.active ? {} : { opacity: 0.55 }) }}>
              <button style={cardTap} onClick={() => setHistory(it)} aria-label={`Historial de ${it.name}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: C.cream, fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.2 }}>{it.name}</div>
                    <div style={{ color: C.faint, fontSize: "0.72rem", marginTop: 2 }}>
                      {it.categoryName}{it.minStock != null ? ` · mín ${fmtQ(it.minStock)}` : ""}
                    </div>
                  </div>
                  {it.low && <Badge text="BAJO MÍNIMO" color={C.red} />}
                </div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ color: it.low ? C.red : C.cream, fontWeight: 800, fontSize: "1.7rem", fontVariantNumeric: "tabular-nums" }}>{fmtQ(it.stock)}</span>
                  <span style={{ color: C.dim, fontSize: "0.8rem" }}>{it.unit.toLowerCase()}</span>
                </div>
              </button>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button style={roundBtn} onClick={() => setMove({ item: it, kind: "ENTRADA" })} aria-label={`Entrada de ${it.name}`}>＋</button>
                <button style={roundBtn} onClick={() => setMove({ item: it, kind: "SALIDA" })} aria-label={`Salida de ${it.name}`}>−</button>
                {adminMode && <button style={{ ...roundBtn, flex: 1, fontSize: "0.8rem", fontWeight: 700 }} onClick={() => setItemModal({ item: it })}>{it.active ? "Editar" : "Restaurar"}</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {move && (
        <MovementSheet
          item={move.item}
          kind={move.kind}
          canMerma={canMerma}
          push={push}
          onClose={() => setMove(null)}
          onDone={() => { setMove(null); refresh(); }}
        />
      )}
      {history && (
        <HistorySheet
          item={history}
          isManager={isManager}
          push={push}
          onClose={() => setHistory(null)}
          onAdjust={() => { const it = history; setHistory(null); setAdjust(it); }}
        />
      )}
      {adjust && (
        <AdjustSheet item={adjust} push={push} onClose={() => setAdjust(null)} onDone={() => { setAdjust(null); refresh(); }} />
      )}
      {catModal && (
        <CategoryModal cat={catModal.cat} push={push} onClose={() => setCatModal(null)} onDone={() => { setCatModal(null); refresh(); }} />
      )}
      {itemModal && (
        <ItemModal item={itemModal.item} categories={activeCats} push={push} onClose={() => setItemModal(null)} onDone={() => { setItemModal(null); refresh(); }} />
      )}
    </div>
  );
}

// ═══════════════════════════════ HOJA DE MOVIMIENTO ═══════════════════════════════

function MovementSheet({ item, kind, canMerma, push, onClose, onDone }: {
  item: AlmItem; kind: "ENTRADA" | "SALIDA"; canMerma: boolean; push: Push; onClose: () => void; onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [merma, setMerma] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [busy, setBusy] = useState(false);

  const isEntrada = kind === "ENTRADA";
  const type = isEntrada ? "ENTRADA" : merma ? "MERMA" : "SALIDA";
  const qty = parseFloat(value) || 0;
  const result = round3(isEntrada ? item.stock + qty : item.stock - qty);
  const needsReason = type === "MERMA";
  const canSubmit = qty > 0 && (!needsReason || reason.trim().length > 0) && !busy;

  const submit = async () => {
    setBusy(true);
    const body: Record<string, unknown> = { type, quantity: qty };
    if (reason.trim()) body.reason = reason.trim();
    if (isEntrada) {
      if (supplier.trim()) body.supplier = supplier.trim();
      const uc = parseFloat(unitCost);
      if (Number.isFinite(uc)) body.unitCost = uc;
    }
    const r = await apiFetch(`/api/almacen/items/${item.id}/movements`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setBusy(false);
    if (r.ok) { push(type === "ENTRADA" ? "Entrada registrada" : type === "MERMA" ? "Merma registrada" : "Salida registrada", "success"); onDone(); }
    else push(r.error ?? "No se pudo registrar", "error");
  };

  const verb = type === "ENTRADA" ? "Entrada" : type === "MERMA" ? "Merma" : "Salida";
  return (
    <>
      <div style={scrim} onClick={onClose} />
      <div style={{ ...sheet, maxHeight: "88vh" }} role="dialog" aria-label={`${verb} de ${item.name}`}>
        <div style={sheetHead}>
          <div style={grip} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: C.cream, fontWeight: 800, fontSize: "1.1rem" }}>{verb} · {item.name}</div>
              <div style={{ color: C.dim, fontSize: "0.82rem", marginTop: 2 }}>Hay {fmtQ(item.stock)} {item.unit.toLowerCase()}</div>
            </div>
            <button style={closeBtn} onClick={onClose} aria-label="Cancelar">×</button>
          </div>
        </div>

        <div style={{ ...sheetBody, overflowY: "auto" }}>
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <span style={{ color: C.cream, fontWeight: 800, fontSize: "2.4rem", fontVariantNumeric: "tabular-nums" }}>{value || "0"}</span>
            <span style={{ color: C.dim, fontSize: "1rem", marginLeft: 8 }}>{item.unit.toLowerCase()}</span>
          </div>
          <Keypad onKey={(k) => setValue((v) => applyKey(v, k))} />

          {!isEntrada && canMerma && (
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, cursor: "pointer", color: C.cream, fontSize: "0.88rem" }}>
              <input type="checkbox" checked={merma} onChange={(e) => setMerma(e.target.checked)} style={{ width: 20, height: 20, accentColor: C.gold }} />
              Es merma (producto que se tiró)
            </label>
          )}

          {isEntrada && (
            <div style={{ marginTop: 16 }}>
              <label style={fld.label}>Proveedor (opcional)</label>
              <input style={fld.input} value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="ej. Distribuidora del Valle" />
              <label style={{ ...fld.label, marginTop: 12 }}>Costo por unidad (opcional)</label>
              <input style={fld.input} value={unitCost} onChange={(e) => setUnitCost(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="0.00" />
            </div>
          )}

          <label style={{ ...fld.label, marginTop: 16 }}>Motivo {needsReason ? "(obligatorio)" : "(opcional)"}</label>
          <input style={fld.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={needsReason ? "¿Qué pasó?" : "Nota (opcional)"} />
        </div>

        <div style={sheetFoot}>
          <button style={{ ...btn.primary, width: "100%", minHeight: 52, opacity: canSubmit ? 1 : 0.5 }} onClick={submit} disabled={!canSubmit}>
            {busy ? "Registrando…" : `Registrar ${verb.toLowerCase()} · quedan ${fmtQ(result)} ${item.unit.toLowerCase()}`}
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════ HISTORIAL ═══════════════════════════════

function HistorySheet({ item, isManager, push, onClose, onAdjust }: {
  item: AlmItem; isManager: boolean; push: Push; onClose: () => void; onAdjust: () => void;
}) {
  const [moves, setMoves] = useState<Movement[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = useCallback(async (cursor?: number) => {
    const url = `/api/almacen/items/${item.id}/movements?limit=50${cursor != null ? `&cursor=${cursor}` : ""}`;
    const r = await apiFetch<Movement[]>(url);
    if (!r.ok) { push(r.error ?? "No se pudo cargar el historial", "error"); return; }
    const page = r.data ?? [];
    setMoves((prev) => (cursor != null && prev ? [...prev, ...page] : page));
    setHasMore(page.length === 50);
  }, [item.id, push]);

  useEffect(() => { loadPage(); }, [loadPage]);

  const more = async () => {
    if (!moves || moves.length === 0) return;
    setLoadingMore(true);
    await loadPage(moves[moves.length - 1].id);
    setLoadingMore(false);
  };

  return (
    <>
      <div style={scrim} onClick={onClose} />
      <div style={{ ...sheet, maxHeight: "88vh" }} role="dialog" aria-label={`Historial de ${item.name}`}>
        <div style={sheetHead}>
          <div style={grip} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: C.cream, fontWeight: 800, fontSize: "1.1rem" }}>{item.name}</div>
              <div style={{ color: C.dim, fontSize: "0.82rem", marginTop: 2 }}>Historial · hay {fmtQ(item.stock)} {item.unit.toLowerCase()}</div>
            </div>
            <button style={closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
          </div>
        </div>

        <div style={{ ...sheetBody, overflowY: "auto" }}>
          {moves === null ? <Spinner /> : moves.length === 0 ? (
            <EmptyState text="Sin movimientos todavía. Registra una entrada para cargar el inventario." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {moves.map((m) => {
                const meta = MOVE_META[m.type];
                return (
                  <div key={m.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <Badge text={meta.label} color={meta.color} />
                      <span style={{ color: C.cream, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                        {meta.sign} {fmtQ(m.quantity)} <span style={{ color: C.dim, fontWeight: 400, fontSize: "0.8rem" }}>→ {fmtQ(m.balanceAfter)} {item.unit.toLowerCase()}</span>
                      </span>
                    </div>
                    <div style={{ color: C.faint, fontSize: "0.72rem", marginTop: 4 }}>
                      {m.createdBy.fullName} · {fmtWhen(m.createdAt)}
                      {m.type === "ENTRADA" && m.supplier ? ` · ${m.supplier}` : ""}
                      {m.type === "ENTRADA" && m.unitCost != null ? ` · $${m.unitCost}/u` : ""}
                    </div>
                    {m.reason && <div style={{ color: C.dim, fontSize: "0.78rem", marginTop: 4 }}>{m.reason}</div>}
                  </div>
                );
              })}
              {hasMore && (
                <button style={{ ...btn.ghost, width: "100%" }} onClick={more} disabled={loadingMore}>{loadingMore ? "…" : "Ver más"}</button>
              )}
            </div>
          )}
        </div>

        {isManager && (
          <div style={sheetFoot}>
            <button style={{ ...btn.primary, width: "100%", minHeight: 52 }} onClick={onAdjust}>Ajustar (conteo físico)</button>
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════ AJUSTE (solo MANAGER) ═══════════════════════════════

function AdjustSheet({ item, push, onClose, onDone }: { item: AlmItem; push: Push; onClose: () => void; onDone: () => void }) {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const counted = parseFloat(value) || 0;
  const diff = round3(counted - item.stock);
  const canSubmit = value !== "" && reason.trim().length > 0 && /^\d{4}$/.test(pin) && !busy;

  const submit = async () => {
    setBusy(true);
    const r = await apiFetch(`/api/almacen/items/${item.id}/movements`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "AJUSTE", quantity: counted, reason: reason.trim(), pin }),
    });
    setBusy(false);
    if (r.ok) { push("Ajuste registrado", "success"); onDone(); }
    else push(r.error ?? "No se pudo registrar el ajuste", "error");
  };

  const u = item.unit.toLowerCase();
  return (
    <>
      <div style={scrim} onClick={onClose} />
      <div style={{ ...sheet, maxHeight: "88vh" }} role="dialog" aria-label={`Ajuste de ${item.name}`}>
        <div style={sheetHead}>
          <div style={grip} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: C.cream, fontWeight: 800, fontSize: "1.1rem" }}>Ajuste · {item.name}</div>
              <div style={{ color: C.dim, fontSize: "0.82rem", marginTop: 2 }}>¿Cuánto hay realmente?</div>
            </div>
            <button style={closeBtn} onClick={onClose} aria-label="Cancelar">×</button>
          </div>
        </div>

        <div style={{ ...sheetBody, overflowY: "auto" }}>
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <span style={{ color: C.cream, fontWeight: 800, fontSize: "2.4rem", fontVariantNumeric: "tabular-nums" }}>{value || "0"}</span>
            <span style={{ color: C.dim, fontSize: "1rem", marginLeft: 8 }}>{u}</span>
          </div>
          <Keypad onKey={(k) => setValue((v) => applyKey(v, k))} />

          <div style={{ marginTop: 16, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={rowKV}><span style={{ color: C.dim }}>El sistema dice</span><span style={{ color: C.cream }}>{fmtQ(item.stock)} {u}</span></div>
            <div style={rowKV}><span style={{ color: C.dim }}>Tú contaste</span><span style={{ color: C.cream }}>{fmtQ(counted)} {u}</span></div>
            <div style={rowKV}><span style={{ color: C.dim }}>Diferencia</span><span style={{ color: diff < 0 ? C.red : diff > 0 ? C.green : C.dim, fontWeight: 800 }}>{diff > 0 ? "+" : ""}{fmtQ(diff)} {u}</span></div>
          </div>

          <label style={{ ...fld.label, marginTop: 16 }}>Motivo (obligatorio)</label>
          <input style={fld.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ej. conteo físico de fin de mes" />
          <label style={{ ...fld.label, marginTop: 12 }}>PIN de Manager</label>
          <input
            style={{ ...fld.input, letterSpacing: "0.5em", textAlign: "center", fontSize: "1.15rem" }}
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric" type="password" placeholder="••••" autoComplete="off" aria-label="PIN de Manager"
          />
        </div>

        <div style={sheetFoot}>
          <button style={{ ...btn.primary, width: "100%", minHeight: 52, opacity: canSubmit ? 1 : 0.5 }} onClick={submit} disabled={!canSubmit}>
            {busy ? "Registrando…" : `Registrar ajuste · ${diff > 0 ? "+" : ""}${fmtQ(diff)} ${u}`}
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════ CATÁLOGO (MANAGER) ═══════════════════════════════

function CategoryModal({ cat, push, onClose, onDone }: { cat: AlmCat | null; push: Push; onClose: () => void; onDone: () => void }) {
  const editing = cat != null;
  const [name, setName] = useState(cat?.name ?? "");
  const [position, setPosition] = useState(cat?.position != null ? String(cat.position) : "");
  const [busy, setBusy] = useState(false);

  const send = async (extra?: Record<string, unknown>) => {
    setBusy(true);
    const base = extra ?? { name: name.trim(), position: position === "" ? null : Number(position) };
    const r = editing
      ? await apiFetch(`/api/almacen/categories/${cat!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(base) })
      : await apiFetch(`/api/almacen/categories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(base) });
    setBusy(false);
    if (r.ok) { push(editing ? "Categoría guardada" : "Categoría creada", "success"); onDone(); }
    else push(r.error ?? "No se pudo guardar", "error");
  };

  return (
    <Modal open title={editing ? "Editar categoría" : "Nueva categoría"} onClose={onClose}>
      <label style={fld.label}>Nombre</label>
      <input style={fld.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="ej. Carnes" />
      <label style={{ ...fld.label, marginTop: 12 }}>Posición (opcional)</label>
      <input style={fld.input} value={position} onChange={(e) => setPosition(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="orden en la lista" />
      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 18 }}>
        {editing ? (
          <button style={btn.ghost} disabled={busy} onClick={() => send({ active: !cat!.active })}>{cat!.active ? "Archivar" : "Restaurar"}</button>
        ) : <span />}
        <button style={{ ...btn.primary, opacity: name.trim() && !busy ? 1 : 0.5 }} disabled={!name.trim() || busy} onClick={() => send()}>{busy ? "…" : "Guardar"}</button>
      </div>
    </Modal>
  );
}

function ItemModal({ item, categories, push, onClose, onDone }: {
  item: AlmItem | null; categories: AlmCat[]; push: Push; onClose: () => void; onDone: () => void;
}) {
  const editing = item != null;
  const [categoryId, setCategoryId] = useState<string>(item ? String(item.categoryId) : (categories[0] ? String(categories[0].id) : ""));
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "PIEZA");
  const [minStock, setMinStock] = useState(item?.minStock != null ? String(item.minStock) : "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const send = async (extra?: Record<string, unknown>) => {
    setBusy(true);
    const base = extra ?? {
      categoryId: Number(categoryId), name: name.trim(), unit,
      minStock: minStock === "" ? null : Number(minStock),
      notes: notes.trim() || null,
    };
    const r = editing
      ? await apiFetch(`/api/almacen/items/${item!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(base) })
      : await apiFetch(`/api/almacen/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(base) });
    setBusy(false);
    if (r.ok) { push(editing ? "Producto guardado" : "Producto creado", "success"); onDone(); }
    else push(r.error ?? "No se pudo guardar", "error");
  };

  const ready = !!categoryId && !!name.trim() && !busy;
  return (
    <Modal open title={editing ? "Editar producto" : "Nuevo producto"} onClose={onClose}>
      <label style={fld.label}>Categoría</label>
      <select style={{ ...fld.input, appearance: "auto" }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <label style={{ ...fld.label, marginTop: 12 }}>Nombre</label>
      <input style={fld.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="ej. Arrachera" />
      <label style={{ ...fld.label, marginTop: 12 }}>Unidad</label>
      <select style={{ ...fld.input, appearance: "auto" }} value={unit} onChange={(e) => setUnit(e.target.value)}>
        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
      <label style={{ ...fld.label, marginTop: 12 }}>Mínimo (opcional)</label>
      <input style={fld.input} value={minStock} onChange={(e) => setMinStock(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="avisa cuando baje de aquí" />
      <label style={{ ...fld.label, marginTop: 12 }}>Notas (opcional)</label>
      <input style={fld.input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="marca, presentación…" />
      {!editing && <div style={{ color: C.faint, fontSize: "0.74rem", marginTop: 8 }}>Empieza en 0: carga el inventario inicial con una entrada.</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 18 }}>
        {editing ? (
          <button style={btn.ghost} disabled={busy} onClick={() => send({ active: !item!.active })}>{item!.active ? "Archivar" : "Restaurar"}</button>
        ) : <span />}
        <button style={{ ...btn.primary, opacity: ready ? 1 : 0.5 }} disabled={!ready} onClick={() => send()}>{busy ? "…" : "Guardar"}</button>
      </div>
    </Modal>
  );
}

// ── estilos ──
const card: React.CSSProperties = { border: `1px solid ${C.line}`, borderRadius: 14, background: C.panel, padding: 14, display: "flex", flexDirection: "column" };
const cardTap: React.CSSProperties = { textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", width: "100%" };
const roundBtn: React.CSSProperties = { minWidth: 44, minHeight: 44, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.cream, fontSize: "1.3rem", cursor: "pointer", fontFamily: "inherit" };
const chipStyle: React.CSSProperties = { minHeight: 40, padding: "0 14px", borderRadius: 999, border: `1px solid ${C.line}`, background: "transparent", color: C.dim, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0 };
const chipOn: React.CSSProperties = { background: "color-mix(in srgb, var(--sl-gold) 16%, transparent)", color: C.gold, borderColor: C.border };
const kpKey: React.CSSProperties = { minHeight: 46, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.cream, fontSize: "1.2rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const rowKV: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: "0.86rem" };

// Hoja de tres zonas (mismo patrón que MenuSelector): cabecera fija · cuerpo scroll · pie fijo.
const scrim: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 96, background: "rgba(0,0,0,0.55)" };
// El alto máximo y el scroll del cuerpo se declaran inline en cada hoja, no aquí.
const sheet: React.CSSProperties = { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 97, background: C.panel, borderTop: `1px solid ${C.border}`, borderRadius: "20px 20px 0 0", padding: "10px 20px 0", maxWidth: 520, margin: "0 auto", boxShadow: "0 -18px 48px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" };
const sheetHead: React.CSSProperties = { flexShrink: 0 };
const sheetBody: React.CSSProperties = { flex: 1, overscrollBehavior: "contain", paddingBottom: 16 };
const sheetFoot: React.CSSProperties = { flexShrink: 0, paddingBottom: "calc(20px + env(safe-area-inset-bottom))" };
const grip: React.CSSProperties = { width: 40, height: 4, borderRadius: 999, background: "rgb(var(--sl-cream-rgb) / 0.25)", margin: "0 auto 14px" };
const closeBtn: React.CSSProperties = { width: 44, height: 44, borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.cream, fontSize: "1.25rem", cursor: "pointer", flexShrink: 0 };
