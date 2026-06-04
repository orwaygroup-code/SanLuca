"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import {
  C, StaffHeader, Spinner, EmptyState, Badge, Modal, btn, fld, formatMXN,
  STATUS_LABEL, STATUS_COLOR, useToasts, ToastHost, useStaffLogout,
} from "@/components/staff/ui";
import { apiFetch, type Comanda, type TableStatus } from "@/components/staff/types";

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

  const load = useCallback(async () => {
    const r = await apiFetch<Comanda[]>("/api/comandas");
    if (r.ok) setComandas(r.data!);
    else { setComandas([]); push(r.error ?? "No se pudo cargar", "error"); }
  }, [push]);

  useEffect(() => {
    if (!loading && !staff) { router.replace("/staff/login?next=/staff/comandas"); return; }
    if (staff) load();
  }, [loading, staff, router, load]);

  if (loading || !staff) return <div style={page.root}><Spinner /></div>;

  return (
    <div style={page.root}>
      <StaffHeader
        title="Mis comandas"
        role={staff.role}
        userName={staff.fullName}
        onLogout={logout}
        right={<button style={btn.primary} onClick={() => setOpenModal(true)}>+ Comanda</button>}
      />

      <main style={page.main}>
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
                  Mesa {c.table.number} · {c.table.section.name}
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
  const [tableId, setTableId] = useState("");
  const [guests, setGuests] = useState(2);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setTableId(""); setGuests(2); return; }
    apiFetch<TableStatus[]>("/api/comandas/tables-status").then((r) => {
      if (r.ok) setTables(r.data!);
      else onError(r.error ?? "No se pudieron cargar las mesas");
    });
  }, [open, onError]);

  const freeTables = useMemo(() => (tables ?? []).filter((t) => t.state === "FREE"), [tables]);

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
    <Modal open={open} title="Abrir comanda" onClose={onClose}>
      {tables === null ? (
        <Spinner label="Cargando mesas…" />
      ) : (
        <>
          <label style={fld.label}>Mesa libre</label>
          <select style={fld.input} value={tableId} onChange={(e) => setTableId(e.target.value)}>
            <option value="">— Selecciona mesa —</option>
            {freeTables.map((t) => (
              <option key={t.id} value={t.id}>Mesa {t.number} · {t.section} (cap. {t.capacity})</option>
            ))}
          </select>
          {freeTables.length === 0 && (
            <p style={{ color: C.amber, fontSize: "0.78rem", marginTop: 8 }}>No hay mesas libres en este momento.</p>
          )}

          <label style={{ ...fld.label, marginTop: 16 }}>Comensales</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button style={stepper} onClick={() => setGuests((g) => Math.max(1, g - 1))}>−</button>
            <span style={{ color: C.cream, fontWeight: 800, fontSize: "1.2rem", minWidth: 36, textAlign: "center" }}>{guests}</span>
            <button style={stepper} onClick={() => setGuests((g) => Math.min(40, g + 1))}>+</button>
          </div>

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

const page: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: C.bg },
  main: { padding: "18px", maxWidth: 980, margin: "0 auto" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 },
  card: {
    textAlign: "left", cursor: "pointer", background: C.panel, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: "16px 16px 18px", fontFamily: "inherit",
  },
};
