"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TableMap } from "@/components/reservation/TableMap";
import type { AvailabilityData, TableSelection } from "@/components/reservation/types";

const SECTIONS = ["Terraza", "Planta Alta", "Salón", "Privado"] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_IMAGES: Record<Section, string> = {
  "Terraza": "/images/terraza.jpg",
  "Planta Alta": "/images/planta-alta.jpg",
  "Salón": "/images/salon.jpg",
  "Privado": "/images/privado.jpg",
};

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

interface FormData {
  guestName: string;
  guestPhone: string;
  date: string;
  time: string;
  guests: number;
  sectionPreference: Section;
  notes: string;
}

type Step = "form" | "map";

export function ReservationForm() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormData>({
    guestName: "", guestPhone: "", date: "", time: "",
    guests: 2, sectionPreference: "Terraza", notes: "",
  });
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [selection, setSelection] = useState<TableSelection | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const set = <K extends keyof FormData>(field: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Slots de horario según el día seleccionado (cada 30 min dentro del horario del restaurante)
  const timeSlots = (() => {
    const isSunday = form.date
      ? (() => { const [y, m, d] = form.date.split("-").map(Number); return new Date(y, m - 1, d).getDay() === 0; })()
      : false;
    const slots: string[] = [];
    const pad = (n: number) => String(n).padStart(2, "0");
    if (isSunday) {
      // Domingo: 08:00 – 21:00
      for (let h = 8; h < 21; h++) { slots.push(`${pad(h)}:00`); slots.push(`${pad(h)}:30`); }
      slots.push("21:00");
    } else {
      // Lunes–Sábado: 08:00 – 23:30 + 00:00
      for (let h = 8; h < 24; h++) { slots.push(`${pad(h)}:00`); slots.push(`${pad(h)}:30`); }
      slots.push("23:30");
    }
    return slots;
  })();

  // ── Paso 1: buscar disponibilidad ─────────────
  async function handleSearch() {
    setSearchError(null);
    setAuthRequired(false);
    if (!localStorage.getItem("userId")) {
      setAuthRequired(true);
      return;
    }
    if (!form.guestName || !form.guestPhone || !form.date || !form.time) {
      setSearchError("Completa todos los campos antes de buscar.");
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({
        section: form.sectionPreference,
        date: form.date,
        time: form.time,
        guests: String(form.guests),
      });
      const res = await fetch(`/api/reservations/available-tables?${params}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      if (!data.data.hasAvailability) {
        setSearchError(`Sin disponibilidad en ${form.sectionPreference} para ese horario. Elige otra área u horario.`);
        return;
      }

      setAvailability(data.data);
      setSelection(null);
      setStep("map");
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : "Error al buscar disponibilidad");
    } finally {
      setSearching(false);
    }
  }

  // ── Paso 2: confirmar reserva ─────────────────
  async function handleConfirm() {
    if (!selection) return;
    if (!localStorage.getItem("userId")) {
      setAuthRequired(true);
      setStep("form");
      return;
    }
    setConfirmError(null);
    setConfirming(true);
    try {
      const userId = localStorage.getItem("userId") ?? "";
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({
          guestName: form.guestName,
          guestPhone: form.guestPhone,
          date: form.date,
          time: form.time,
          guests: form.guests,
          sectionPreference: form.sectionPreference,
          notes: form.notes || undefined,
          tableId: selection.tableId,
          linkedTableId: selection.linkedTableId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      router.push("/dashboard");
    } catch (e: unknown) {
      setConfirmError(e instanceof Error ? e.message : "Error al crear la reserva");
    } finally {
      setConfirming(false);
    }
  }

  // ── Slide del switch ──────────────────────────
  const activeIdx = SECTIONS.indexOf(form.sectionPreference);
  const thumbLeft = `calc(${(activeIdx / SECTIONS.length) * 100}% + 4px)`;
  const thumbWidth = `calc(${100 / SECTIONS.length}% - 8px)`;

  // ── Resumen de mesa seleccionada ──────────────
  const selectionLabel = selection
    ? selection.linkedTableNumber
      ? `Mesa M${selection.tableNumber} + M${selection.linkedTableNumber} (combinadas)`
      : `Mesa M${selection.tableNumber}`
    : null;

  // ─────────────────────────────────────────────
  return (
    <div className={`rf-wrapper${step === "map" ? " rf-wrapper--map" : ""}`}>

      {/* ── Panel izquierdo ── */}
      <div className="rf-left">
        <div>
          <h1 className="rf-hero-title">Reservar Mesa</h1>
          <p className="rf-hero-sub">Tu mejor experiencia culinaria</p>
        </div>

        <div className="rf-image-wrapper">
          <div className="rf-image-box">
            {SECTIONS.map((sec) => (
              <img
                key={sec}
                src={SECTION_IMAGES[sec]}
                alt={sec}
                className="rf-image"
                style={{ opacity: form.sectionPreference === sec ? 1 : 0 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.background =
                    "linear-gradient(135deg, #2a2f2e 0%, #3a3228 100%)";
                }}
              />
            ))}
          </div>

          {/* Switch de sección (4 opciones en el mismo track) */}
          <div className="rf-switch-overlay">
            <div className="rf-switch-track" style={{ display: "grid", gridTemplateColumns: `repeat(${SECTIONS.length}, 1fr)`, position: "relative" }}>
              <div className="rf-switch-thumb" style={{ left: thumbLeft, width: thumbWidth }} />
              {SECTIONS.map((sec) => (
                <button
                  key={sec}
                  className={`rf-switch-btn${form.sectionPreference === sec ? " rf-switch-btn--active" : ""}`}
                  onClick={() => { set("sectionPreference", sec as Section); setStep("form"); setAvailability(null); setSelection(null); }}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Panel derecho ── */}
      <div className="rf-right">

        {step === "form" && (
          <>
            <div>
              <h2 className="rf-form-title">Crea tu Reserva</h2>
              <p className="rf-form-sub">Tu reservación desde tu móvil</p>
            </div>

            <div className="rf-divider" />

            <div>
              <label className="rf-label">Nombre</label>
              <input className="rf-input" placeholder="Ej. María González" value={form.guestName}
                onChange={(e) => set("guestName", e.target.value)} />
            </div>

            <div>
              <label className="rf-label">Número celular</label>
              <input className="rf-input" type="tel" placeholder=" 55 0000 0000" value={form.guestPhone}
                onChange={(e) => set("guestPhone", e.target.value)} />
            </div>

            <div className="rf-row-three">
              <div>
                <label className="rf-label">Fecha</label>
                <input className="rf-input" type="date" value={form.date}
                  min={new Date().toISOString().split("T")[0]} style={{ colorScheme: "dark" }}
                  onChange={(e) => { set("date", e.target.value); set("time", ""); }} />
              </div>
              <div>
                <label className="rf-label">Hora</label>
                <select className="rf-select" value={form.time}
                  onChange={(e) => set("time", e.target.value)}
                  disabled={!form.date}>
                  <option value="" disabled>{form.date ? "Selecciona hora" : "Elige fecha primero"}</option>
                  {timeSlots.map((t) => (
                    <option key={t} value={t} style={{ background: "#1b2224" }}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="rf-label">Personas</label>
                <select className="rf-select" value={form.guests}
                  onChange={(e) => set("guests", Number(e.target.value))}>
                  {PARTY_SIZES.map((n) => (
                    <option key={n} value={n} style={{ background: "#1b2224" }}>
                      {n} {n === 1 ? "persona" : "personas"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="rf-label">Solicitud especial</label>
              <textarea className="rf-textarea" placeholder="Alergias, decoración, peticiones especiales..."
                value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} />
            </div>

            {searchError && <div className="rf-error">⚠ {searchError}</div>}

            {authRequired && (
              <div style={{ background: "rgba(186,132,60,0.08)", border: "1px solid rgba(186,132,60,0.4)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ margin: "0 0 10px", fontSize: "0.8rem", color: "#f5f1e8", textAlign: "center" }}>
                  Para continuar debes iniciar sesión o crear una cuenta.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => router.push("/login?redirect=/reservation")}
                    style={{ flex: 1, padding: "9px 0", background: "#ba843c", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", letterSpacing: "0.04em" }}
                  >
                    Iniciar Sesión
                  </button>
                  <button
                    onClick={() => router.push("/register?redirect=/reservation")}
                    style={{ flex: 1, padding: "9px 0", background: "transparent", border: "1px solid rgba(186,132,60,0.5)", borderRadius: 8, color: "rgba(245,241,232,0.8)", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", letterSpacing: "0.04em" }}
                  >
                    Registrarse
                  </button>
                </div>
              </div>
            )}

            <button className="rf-submit" onClick={handleSearch} disabled={searching}>
              {searching ? "Buscando..." : "Buscar Mesa"}
            </button>
          </>
        )}

        {step === "map" && availability && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => { setStep("form"); setSelection(null); }}
                style={{ background: "none", border: "1px solid rgba(186,132,60,0.4)", borderRadius: 8, color: "rgba(245,241,232,0.7)", padding: "6px 14px", cursor: "pointer", fontSize: "0.75rem" }}
              >
                ← Volver
              </button>
              <div>
                <h2 className="rf-form-title" style={{ margin: 0 }}>Selecciona tu Mesa</h2>
                <p className="rf-form-sub" style={{ margin: 0 }}>{form.sectionPreference} · {form.guests} {form.guests === 1 ? "persona" : "personas"} · {form.date} {form.time}</p>
              </div>
            </div>

            <div className="rf-divider" />

            <TableMap
              data={availability}
              guests={form.guests}
              selection={selection}
              onSelect={setSelection}
            />

            {selectionLabel && (
              <div style={{ textAlign: "center", padding: "10px 0", color: "#ba843c", fontSize: "0.85rem", fontWeight: 600 }}>
                {selectionLabel}
              </div>
            )}

            {confirmError && <div className="rf-error">⚠ {confirmError}</div>}

            <button
              className="rf-submit"
              onClick={handleConfirm}
              disabled={!selection || confirming}
              style={{ opacity: selection ? 1 : 0.4 }}
            >
              {confirming ? "Confirmando..." : "Confirmar Reserva"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
