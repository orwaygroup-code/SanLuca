"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import {
  C, StaffHeader, Spinner, EmptyState, Badge, Modal, btn, fld, formatMXN,
  STATUS_LABEL, STATUS_COLOR, useToasts, ToastHost, useStaffLogout, usePoll,
} from "@/components/staff/ui";
import { apiFetch, type Comanda, type TableStatus } from "@/components/staff/types";
import { Tour, type TourStep } from "@/components/staff/Tour";

/** Tutorial guiado de la vista Mesero (mis comandas). */
const MESERO_TOUR: TourStep[] = [
  { title: "Tus comandas", body: "Aquí ves solo las mesas y cuentas que TÚ tienes abiertas. Toca cualquiera para capturar platillos, cambiar cantidades o mandar a cocina/barra." },
  { target: "nueva", title: "Abrir una mesa nueva", body: "Toca «+ Comanda»: primero eliges el área (Salón, Terraza, Privado…), luego la mesa libre y cuántos comensales son.", task: "Toca «+ Comanda» para probar." },
  { target: "lista", title: "Tus cuentas activas", body: "Cada tarjeta muestra el folio, la mesa o nombre, cuántos platillos lleva y el total en vivo. Tócala para entrar a capturar." },
  { title: "¿Dudas después?", body: "Puedes reabrir este tutorial cuando quieras con el botón «?» de arriba a la derecha." },
];

/**
 * Vista Mesero — lista de SUS comandas activas y apertura de comanda nueva.
 * Realm sl_staff. El detalle de captura vive en /staff/comandas/[id].
 */
export default function MeseroComandasPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const { toasts, push, dismiss } = useToasts();

  const [comandas, setComandas] = useState<Comanda[] | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const autoTourDone = useRef(false);

  const load = useCallback(async () => {
    const r = await apiFetch<Comanda[]>("/api/comandas");
    if (r.ok) setComandas(r.data!);
    else { setComandas([]); push(r.error ?? "No se pudo cargar", "error"); }
  }, [push]);

  useEffect(() => {
    if (!loading && !staff) { router.replace("/staff/login?next=/staff/comandas"); return; }
    if (staff) load();
  }, [loading, staff, router, load]);

  usePoll(load, 8000, !!staff); // refresco en vivo de mis comandas

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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setTourOpen(true)} title="Tutorial" aria-label="Abrir tutorial"
              style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.gold, fontWeight: 800, fontSize: "1.05rem", cursor: "pointer" }}>?</button>
            <button data-tour="nueva" style={btn.primary} onClick={() => setOpenModal(true)}>+ Comanda</button>
          </div>
        }
      />

      <main style={page.main} data-tour="lista">
        {comandas === null ? (
          <Spinner />
        ) : comandas.length === 0 ? (
          <EmptyState text="No tienes comandas abiertas. Toca «+ Comanda» para abrir una." />
        ) : (
          <div style={page.grid}>
            {comandas.map((c) => (
              <button key={c.id} style={page.card} onClick={() => router.push(`/staff/comandas/${c.id}`)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: C.gold, fontWeight: 800, fontSize: "0.78rem", letterSpacing: "0.05em" }}>{c.folio}</span>
                  <Badge text={STATUS_LABEL[c.status] ?? c.status} color={STATUS_COLOR[c.status] ?? C.dim} />
                </div>
                <div style={{ color: C.cream, fontSize: "1.05rem", fontWeight: 700, marginTop: 8 }}>
                  {c.table ? `Mesa ${c.table.number} · ${c.table.section.name}` : (c.customName || "Cuenta sin mesa")}
                </div>
                <div style={{ color: C.dim, fontSize: "0.8rem", marginTop: 2 }}>
                  {c.guestsActual} pers · {c.items.filter((i) => i.status !== "CANCELLED").length} items
                </div>
                <div style={{ color: C.cream, fontSize: "1.1rem", fontWeight: 800, marginTop: 10 }}>
                  {formatMXN(Number(c.total))}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <NewComandaModal
        open={openModal}
        defaultWaiterId={staff.id}
        onClose={() => setOpenModal(false)}
        onCreated={(id) => { setOpenModal(false); router.push(`/staff/comandas/${id}`); }}
        onError={(m) => push(m, "error")}
      />
      <Tour steps={MESERO_TOUR} open={tourOpen} onClose={closeTour} />
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
};
