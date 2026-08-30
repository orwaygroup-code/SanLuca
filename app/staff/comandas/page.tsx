"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import { ModeSwitch } from "@/components/staff/ModeSwitch";
import {
  C, StaffHeader, Spinner, EmptyState, Badge, Modal, btn, fld, formatMXN,
  STATUS_LABEL, STATUS_COLOR, useToasts, ToastHost, useStaffLogout, usePoll, useIsPhone,
} from "@/components/staff/ui";
import { apiFetch, type Comanda, type TableStatus } from "@/components/staff/types";
import { Tour, type TourStep } from "@/components/staff/Tour";
import { FaltantesPanel } from "@/components/staff/FaltantesPanel";
import { Icon } from "@/components/staff/icons";

/** Tutorial guiado de la vista Mesero (mis comandas). */
const MESERO_TOUR: TourStep[] = [
  { title: "Tus comandas", body: "Aquí ves solo las mesas y cuentas que TÚ tienes abiertas. Toca cualquiera para capturar platillos, cambiar cantidades o mandar a cocina/barra." },
  { target: "nueva", title: "Abrir una mesa nueva", body: "Toca «+ Comanda»: primero eliges el área (Salón, Terraza, Privado…), luego la mesa libre y cuántos comensales son.", task: "Toca «+ Comanda» para probar." },
  { target: "lista", title: "Tus cuentas activas", body: "Cada tarjeta muestra el folio, la mesa o nombre, cuántos platillos lleva y el total en vivo. Tócala para entrar a capturar." },
  { title: "¿Dudas después?", body: "Puedes reabrir este tutorial cuando quieras con el botón «?» de arriba a la derecha." },
];

const POR_PAGAR_ALERT_MS = 60 * 60 * 1000;  // 1 h en "por pagar" antes de alertar al mesero
const ALERT_REPEAT_MS    = 4 * 60 * 1000;   // re-alerta cada 4 min (sin empalmarse)

function comandaLabel(c: Comanda): string {
  return c.table ? `Mesa ${c.table.number} · ${c.table.section.name}` : (c.customName || "Cuenta sin mesa");
}

/**
 * Vista Mesero — lista de SUS comandas activas y apertura de comanda nueva.
 * Realm sl_staff. El detalle de captura vive en /staff/comandas/[id].
 */
export default function MeseroComandasPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const { toasts, push, dismiss } = useToasts();
  const isPhone = useIsPhone(); // vista compacta en celular (se diseñó para tablet)

  const [comandas, setComandas] = useState<Comanda[] | null>(null);
  const [openModal, setOpenModal] = useState(false);
  // Panel 86/101 embebido: cambia SOLO el cuerpo de esta vista (el mesero no sale de sus comandas).
  const [panelView, setPanelView] = useState<null | "86" | "101">(null);
  const [tourOpen, setTourOpen] = useState(false);
  const autoTourDone = useRef(false);
  // Alerta "cuenta por pagar > 1h": ventana cada 4 min, UNA a la vez (no se empalma).
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [payAlertOpen, setPayAlertOpen] = useState(false);
  const lastPayAlertRef = useRef(0);

  const load = useCallback(async () => {
    // mine=1: si es Capitán/Manager en "modo mesero", ve SOLO sus comandas (el WAITER
    // ya queda forzado a lo suyo en el server; el param no le afecta).
    const r = await apiFetch<Comanda[]>("/api/comandas?mine=1");
    if (r.ok) setComandas(r.data!);
    else { setComandas([]); push(r.error ?? "No se pudo cargar", "error"); }
  }, [push]);

  useEffect(() => {
    if (!loading && !staff) { router.replace("/staff/login?next=/staff/comandas"); return; }
    if (staff) load();
  }, [loading, staff, router, load]);

  usePoll(load, 8000, !!staff); // refresco en vivo de mis comandas

  // Reloj para la alerta de "por pagar" (corre cada 30 s).
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  // Mis cuentas en "por pagar" que llevan +1h sin cobrarse.
  const overduePorPagar = useMemo(() => {
    const cutoff = nowTs - POR_PAGAR_ALERT_MS;
    return (comandas ?? []).filter((c) =>
      (c.status === "AWAITING_PAYMENT" || c.status === "PARTIALLY_PAID") &&
      c.awaitingPaymentAt != null && new Date(c.awaitingPaymentAt).getTime() < cutoff,
    );
  }, [comandas, nowTs]);
  // Dispara la ventana cada 4 min, UNA a la vez: no se abre si ya hay una, ni antes de 4 min
  // desde la última vez que se cerró.
  useEffect(() => {
    if (overduePorPagar.length === 0) { if (payAlertOpen) setPayAlertOpen(false); return; }
    if (payAlertOpen) return;
    if (nowTs - lastPayAlertRef.current >= ALERT_REPEAT_MS) setPayAlertOpen(true);
  }, [overduePorPagar, nowTs, payAlertOpen]);
  const dismissPayAlert = () => { lastPayAlertRef.current = Date.now(); setPayAlertOpen(false); };

  // Auto-abrir el tutorial la primera vez (una vez por dispositivo).
  useEffect(() => {
    if (!autoTourDone.current && staff && typeof window !== "undefined" && !localStorage.getItem("sl_tour_comandas_v1")) {
      autoTourDone.current = true;
      setTourOpen(true);
    }
  }, [staff]);
  const closeTour = () => { setTourOpen(false); try { localStorage.setItem("sl_tour_comandas_v1", "1"); } catch { /* ignore */ } };

  if (loading || !staff) return <div style={page.root}><Spinner /></div>;

  return (
    <div style={page.root}>
      <StaffHeader
        title="Mis comandas"
        role={staff.role}
        userName={staff.fullName}
        onLogout={logout}
        right={
          // flexWrap: en un celular estos controles no caben en una fila y antes
          // se salían del ancho de la pantalla. El encabezado ya envolvía, pero
          // este grupo interno no, así que formaba un bloque indivisible más
          // ancho que el viewport.
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}>
            <ModeSwitch role={staff.role} />
            {/* Un solo botón para 86 y 101. Tener dos era redundante: el panel
                que abren ya trae su propio conmutador entre ambas secciones,
                así que la elección se hacía dos veces. Unificarlos libera
                espacio en la barra, que es lo que faltaba en móvil. */}
            {(() => {
              const on = panelView !== null;
              return (
                <button onClick={() => setPanelView(on ? null : "86")} aria-pressed={on}
                  title="Faltantes (86) y Priorizar (101)" aria-label="Faltantes y priorizar"
                  style={{ width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 999, border: `1px solid ${on ? C.gold : C.border}`, background: on ? C.gold : "transparent", color: on ? "#16201f" : C.gold, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                  <Icon name="faltantes101" size={21} />
                </button>
              );
            })()}
            <button onClick={() => router.push("/staff/wallet")} title="Mi saldo" aria-label="Mi saldo"
              style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.gold, fontWeight: 800, fontSize: "1rem", cursor: "pointer" }}>$</button>
            <button onClick={() => setTourOpen(true)} title="Tutorial" aria-label="Abrir tutorial"
              style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.gold, fontWeight: 800, fontSize: "1.05rem", cursor: "pointer" }}>?</button>
            <button data-tour="nueva" style={btn.primary} onClick={() => setOpenModal(true)}>+ Comanda</button>
          </div>
        }
      />

      <main style={page.main} data-tour="lista">
        {panelView ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <button onClick={() => setPanelView(null)} style={btn.ghost}>← Regresar a comandas</button>
            </div>
            <FaltantesPanel role={staff.role} initialTab={panelView} push={push} />
          </>
        ) : comandas === null ? (
          <Spinner />
        ) : comandas.length === 0 ? (
          <EmptyState text="No tienes comandas abiertas. Toca «+ Comanda» para abrir una." />
        ) : (
          <div style={isPhone ? page.gridSm : page.grid}>
            {comandas.map((c) => {
              const label = c.table ? `Mesa ${c.table.number} · ${c.table.section.name}` : (c.customName || "Cuenta sin mesa");
              const items = c.items.filter((i) => i.status !== "CANCELLED").length;
              return (
              <button key={c.id} style={isPhone ? page.cardSm : page.card} onClick={() => router.push(`/staff/comandas/${c.id}?back=/staff/comandas`)}>
                {isPhone ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ color: C.gold, fontWeight: 800, fontSize: "0.72rem", letterSpacing: "0.04em" }}>{c.folio}</span>
                      <Badge text={STATUS_LABEL[c.status] ?? c.status} color={STATUS_COLOR[c.status] ?? C.dim} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 5 }}>
                      <span style={{ color: C.cream, fontSize: "0.95rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                      <span style={{ color: C.cream, fontSize: "1rem", fontWeight: 800, whiteSpace: "nowrap" }}>{formatMXN(Number(c.total))}</span>
                    </div>
                    <div style={{ color: C.dim, fontSize: "0.74rem", marginTop: 2 }}>{c.guestsActual} pers · {items} items</div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: C.gold, fontWeight: 800, fontSize: "0.78rem", letterSpacing: "0.05em" }}>{c.folio}</span>
                      <Badge text={STATUS_LABEL[c.status] ?? c.status} color={STATUS_COLOR[c.status] ?? C.dim} />
                    </div>
                    <div style={{ color: C.cream, fontSize: "1.05rem", fontWeight: 700, marginTop: 8 }}>{label}</div>
                    <div style={{ color: C.dim, fontSize: "0.8rem", marginTop: 2 }}>{c.guestsActual} pers · {items} items</div>
                    <div style={{ color: C.cream, fontSize: "1.1rem", fontWeight: 800, marginTop: 10 }}>{formatMXN(Number(c.total))}</div>
                  </>
                )}
              </button>
              );
            })}
          </div>
        )}
      </main>

      <NewComandaModal
        open={openModal}
        defaultWaiterId={staff.id}
        onClose={() => setOpenModal(false)}
        onCreated={(id) => { setOpenModal(false); router.push(`/staff/comandas/${id}?back=/staff/comandas`); }}
        onError={(m) => push(m, "error")}
      />
      <Tour steps={MESERO_TOUR} open={tourOpen} onClose={closeTour} />

      {/* Alerta al mesero: cuenta(s) en "por pagar" hace más de 1h. Reaparece cada 4 min hasta
          que se cobren. Una sola ventana a la vez (onClose no-op → solo cierra con el botón). */}
      <Modal open={payAlertOpen} title="Cuentas por pagar pendientes" onClose={() => {}}>
        <p style={{ margin: "0 0 12px", color: C.dim, fontSize: "0.9rem", lineHeight: 1.5 }}>
          Tienes {overduePorPagar.length === 1 ? "una cuenta" : `${overduePorPagar.length} cuentas`} en <b style={{ color: C.cream }}>por pagar</b> desde hace más de 1 hora. Cóbrala(s) o pásala(s) a caja.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {overduePorPagar.map((c) => (
            <button key={c.id} onClick={() => { dismissPayAlert(); router.push(`/staff/comandas/${c.id}?back=/staff/comandas`); }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, textAlign: "left", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ color: C.cream, fontWeight: 700, fontSize: "0.9rem" }}>{comandaLabel(c)}</span>
              <span style={{ color: "#e8766b", fontSize: "0.78rem", fontWeight: 700 }}>{formatMXN(Number(c.total))}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button style={btn.primary} onClick={dismissPayAlert}>Entendido</button>
        </div>
      </Modal>

      <ToastHost toasts={toasts} onClose={dismiss} />
    </div>
  );
}

// ─────────────────────────────────────────────── Modal: abrir comanda ──
function NewComandaModal({ open, defaultWaiterId, onClose, onCreated, onError }: {
  open: boolean; defaultWaiterId: number;
  onClose: () => void; onCreated: (id: number) => void; onError: (m: string) => void;
}) {
  const [tables, setTables] = useState<TableStatus[] | null>(null);
  const [section, setSection] = useState("");
  const [tableId, setTableId] = useState("");
  const [guests, setGuests] = useState(2);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setSection(""); setTableId(""); setGuests(2); return; }
    setTables(null);
    apiFetch<TableStatus[]>("/api/comandas/tables-status").then((r) => {
      if (r.ok) setTables(r.data!);
      else onError(r.error ?? "No se pudieron cargar las mesas");
    });
  }, [open, onError]);

  const freeTables = useMemo(() => (tables ?? []).filter((t) => t.state === "FREE"), [tables]);
  // Áreas derivadas de TODAS las mesas activas (no solo las libres): así un área
  // con su única mesa ocupada (p. ej. Privado) sigue apareciendo en el selector.
  const sections = useMemo(() => [...new Set((tables ?? []).map((t) => t.section))].sort(), [tables]);
  const sectionTables = useMemo(
    () => freeTables.filter((t) => t.section === section).sort((a, b) => a.number - b.number),
    [freeTables, section],
  );

  const submit = async () => {
    if (!tableId || busy) return;
    setBusy(true);
    const r = await apiFetch<Comanda>("/api/comandas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, guests, waiterId: defaultWaiterId }),
    });
    setBusy(false);
    if (r.ok) onCreated(r.data!.id);
    else onError(r.error ?? "No se pudo abrir la comanda");
  };

  return (
    <Modal open={open} title="Abrir mesa" onClose={onClose}>
      {tables === null ? (
        <Spinner label="Cargando mesas…" />
      ) : freeTables.length === 0 ? (
        <p style={{ color: C.amber, fontSize: "0.86rem", padding: "8px 0" }}>No hay mesas libres en este momento.</p>
      ) : (
        <>
          <label style={fld.label}>1 · Elige el área</label>
          <div style={nc.chips}>
            {sections.map((sec) => (
              <button key={sec} onClick={() => { setSection(sec); setTableId(""); }} style={{ ...nc.chip, ...(section === sec ? nc.chipOn : {}) }}>{sec}</button>
            ))}
          </div>

          {section && (
            <>
              <label style={{ ...fld.label, marginTop: 18 }}>2 · Mesa libre en {section}</label>
              {sectionTables.length === 0 ? (
                <p style={{ color: C.faint, fontSize: "0.82rem" }}>Sin mesas libres en esta área.</p>
              ) : (
                <div style={nc.chips}>
                  {sectionTables.map((t) => (
                    <button key={t.id} onClick={() => setTableId(t.id)} style={{ ...nc.tableChip, ...(tableId === t.id ? nc.chipOn : {}) }}>
                      <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>Mesa {t.number}</span>
                      <span style={{ fontSize: "0.62rem", opacity: 0.75 }}>cap. {t.capacity}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {tableId && (
            <>
              <label style={{ ...fld.label, marginTop: 18 }}>3 · Comensales</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button style={stepper} onClick={() => setGuests((g) => Math.max(1, g - 1))}>−</button>
                <span style={{ color: C.cream, fontWeight: 800, fontSize: "1.2rem", minWidth: 36, textAlign: "center" }}>{guests}</span>
                <button style={stepper} onClick={() => setGuests((g) => Math.min(40, g + 1))}>+</button>
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
            <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
            <button style={{ ...btn.primary, opacity: !tableId || busy ? 0.5 : 1 }} onClick={submit} disabled={!tableId || busy}>
              {busy ? "Abriendo…" : "Abrir comanda"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

const stepper: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 9, border: `1px solid ${C.line}`,
  background: "transparent", color: C.cream, fontSize: "1.3rem", cursor: "pointer",
};

const nc: Record<string, React.CSSProperties> = {
  chips: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    minHeight: 44, padding: "0 16px", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent",
    color: C.dim, fontWeight: 700, fontSize: "0.86rem", cursor: "pointer", fontFamily: "inherit",
  },
  tableChip: {
    minWidth: 78, minHeight: 56, padding: "6px 12px", borderRadius: 10, border: `1px solid ${C.line}`,
    background: "transparent", color: C.cream, cursor: "pointer", fontFamily: "inherit",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
  },
  chipOn: { background: C.gold, color: "#16201f", borderColor: C.gold },
};

const page: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: C.bg },
  main: { padding: "18px", maxWidth: 1200, margin: "0 auto" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 },
  card: {
    textAlign: "left", cursor: "pointer", background: C.panel, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: "16px 16px 18px", fontFamily: "inherit",
  },
  // Variantes compactas para celular (pantallas angostas): una columna, tarjetas densas.
  gridSm: { display: "grid", gridTemplateColumns: "1fr", gap: 8 },
  cardSm: {
    textAlign: "left", cursor: "pointer", background: C.panel, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: "11px 13px", fontFamily: "inherit",
  },
};
