"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import {
  C, StaffHeader, Spinner, EmptyState, Badge, ConfirmModal, btn, fld,
  useToasts, ToastHost, useStaffLogout, usePoll,
} from "@/components/staff/ui";
import { apiFetch } from "@/components/staff/types";
import type { Reservation } from "@/components/reservation/types";

// ── Estado de reservas (idéntico a /admin) ─────────────────────────────────
const RES_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "ESPERA PAGO",
  PENDING:     "PENDIENTE",
  CONFIRMED:   "CONFIRMADA",
  IN_PROGRESS: "EN CURSO",
  DELAYED:     "RETRASO",
  CANCELLED:   "CANCELADA",
  COMPLETED:   "COMPLETADA",
  NO_SHOW:     "NO SE PRESENTÓ",
};
const RES_STATUS_COLOR: Record<string, string> = {
  PENDING_PAYMENT: "#e09632",
  PENDING:     "#c9964a",
  CONFIRMED:   "#63aede",
  IN_PROGRESS: "#5cbf60",
  DELAYED:     "#e8766b",
  CANCELLED:   "rgba(255,255,255,0.6)",
  COMPLETED:   "rgba(255,255,255,0.55)",
  NO_SHOW:     "#d95f4a",
};
const DELETABLE = ["CANCELLED", "NO_SHOW", "COMPLETED"];

const MX_TZ = "America/Mexico_City";
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: MX_TZ, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: MX_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

/** Historial de reservas (staff / hostess) — lista completa, solo lectura + borrado terminal. */
export default function HistorialPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const { toasts, push, dismiss } = useToasts();

  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [search, setSearch] = useState("");
  const [delTarget, setDelTarget] = useState<Reservation | null>(null);
  const [busy, setBusy] = useState(false);

  const allowed = staff && ["OPERATION", "CAPTAIN", "MANAGER"].includes(staff.role);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ all: "1" });
    if (search) params.set("search", search);
    const r = await apiFetch<Reservation[]>(`/api/staff/reservations?${params.toString()}`);
    if (r.ok) setReservations(r.data!);
    else { setReservations([]); push(r.error ?? "Error al cargar el historial", "error"); }
  }, [search, push]);

  useEffect(() => {
    if (!loading && !staff) { router.replace("/staff/login?next=/staff/historial"); return; }
    if (staff && !allowed) { router.replace("/staff/login"); return; }
    if (staff && allowed) load();
  }, [loading, staff, allowed, router, load]);

  usePoll(load, 8000, !!allowed); // refresco en vivo

  const doDelete = async () => {
    if (!delTarget) return;
    setBusy(true);
    const r = await apiFetch(`/api/staff/reservations/${delTarget.id}`, { method: "DELETE" });
    setBusy(false);
    if (r.ok) { push("Reserva eliminada", "success"); setDelTarget(null); load(); }
    else push(r.error ?? "No se pudo eliminar", "error");
  };

  if (loading || !staff || !allowed) return <div style={page.root}><Spinner /></div>;

  return (
    <div style={page.root}>
      <StaffHeader
        title="Historial"
        role={staff.role}
        userName={staff.fullName}
        onLogout={logout}
        onBack={() => router.push("/staff/operacion")}
        right={<button style={btn.ghost} onClick={load}>↻</button>}
      />

      <main style={page.main}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            style={{ ...fld.input, flex: 1 }}
            placeholder="Buscar nombre o celular…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
          />
          <button style={btn.ghost} onClick={load}>Buscar</button>
        </div>

        {reservations === null ? <Spinner /> :
        reservations.length === 0 ? <EmptyState text="No hay reservas en el historial." /> : (
          <div style={page.list}>
            {reservations.map((r) => (
              <div key={r.id} style={page.row}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ color: C.cream, fontWeight: 700 }}>{r.guestName}</span>
                    <Badge text={RES_STATUS_LABEL[r.status] ?? r.status} color={RES_STATUS_COLOR[r.status] ?? C.dim} />
                  </div>
                  <div style={{ color: C.dim, fontSize: "0.8rem", marginTop: 3 }}>
                    {fmtDate(r.date)} · {fmtTime(r.date)} · {r.guests} pers
                  </div>
                  <div style={{ color: C.faint, fontSize: "0.76rem", marginTop: 2 }}>
                    {r.table ? `Mesa ${r.table.number} · ${r.table.section.name}` : r.sectionPreference ? `pref. ${r.sectionPreference}` : "Sin mesa"}
                  </div>
                </div>
                {DELETABLE.includes(r.status) && (
                  <button style={{ ...miniOutline, borderColor: C.red, color: C.red }} onClick={() => setDelTarget(r)}>Eliminar</button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <ConfirmModal
        open={!!delTarget}
        title="Eliminar reserva"
        message={delTarget ? `¿Eliminar definitivamente la reserva de ${delTarget.guestName}? Esta acción no se puede deshacer.` : ""}
        confirmLabel="Eliminar"
        danger
        busy={busy}
        onConfirm={doDelete}
        onCancel={() => setDelTarget(null)}
      />

      <ToastHost toasts={toasts} onClose={dismiss} />
    </div>
  );
}

const miniOutline: React.CSSProperties = {
  padding: "7px 11px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent",
  color: C.dim, fontSize: "0.76rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
};

const page: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: C.bg },
  main: { padding: "16px 18px", maxWidth: 1000, margin: "0 auto" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" },
};
