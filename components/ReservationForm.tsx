"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TableMap } from "@/components/reservation/TableMap";
import type { AvailabilityData, TableSelection } from "@/components/reservation/types";
import { GoldSelect } from "@/components/ui/GoldSelect";
import type { SelectOption } from "@/components/ui/GoldSelect";
import { GuestsPicker } from "@/components/ui/GuestsPicker";

const SECTIONS = ["Terraza", "Planta Alta", "Salón", "Privado"] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_IMAGES: Record<Section, string> = {
  "Terraza":    "/images/areas/terraza.jpg",
  "Planta Alta": "/images/areas/pAlta.jpg",
  "Salón":      "/images/areas/salon.jpg",
  "Privado":    "/images/areas/privado.jpg",
};


interface FormData {
  guestName: string;
  guestPhone: string;
  date: string;
  time: string;
  guests: number;
  sectionPreference: Section;
  notes: string;
}

type Step = "form" | "map" | "large-confirm";

export function ReservationForm() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormData>({
    guestName: "", guestPhone: "", date: "", time: "",
    guests: 2, sectionPreference: "Terraza", notes: "",
  });
  const [largeGroupMode, setLargeGroupMode] = useState(false);
  const [customGuestsInput, setCustomGuestsInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [selection, setSelection] = useState<TableSelection | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const set = <K extends keyof FormData>(field: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Slots de horario según el día seleccionado
  const { timeSlots, isDayClosed } = (() => {
    if (!form.date) return { timeSlots: [], isDayClosed: false };
    const [y, mo, d] = form.date.split("-").map(Number);
    const dow = new Date(y, mo - 1, d).getDay();
    if (dow === 1) return { timeSlots: [], isDayClosed: true }; // Lunes cerrado
    const slots: string[] = [];
    const pad = (n: number) => String(n).padStart(2, "0");
    const closeHour = dow === 0 ? 21 : (dow === 5 || dow === 6) ? 24 : 23;
    for (let h = 8; h < closeHour; h++) { slots.push(`${pad(h)}:00`); slots.push(`${pad(h)}:30`); }
    if (closeHour < 24) slots.push(`${pad(closeHour)}:00`);
    return { timeSlots: slots, isDayClosed: false };
  })();

  // ── Helpers de autenticación y validación ─────
  function checkAuth() {
    if (!localStorage.getItem("userId")) {
      setAuthRequired(true);
      return false;
    }
    return true;
  }

  function validateBaseFields() {
    if (!form.guestName || !form.guestPhone || !form.date || !form.time) {
      setSearchError("Completa todos los campos antes de buscar.");
      return false;
    }
    if (largeGroupMode && form.guests < 16) {
      setSearchError("Para grupo grande ingresa al menos 16 personas.");
      return false;
    }
    return true;
  }

  // ── Paso 1: buscar disponibilidad ─────────────
  async function handleSearch() {
    setSearchError(null);
    setAuthRequired(false);
    if (!checkAuth()) return;
    if (!validateBaseFields()) return;

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

      // ── Grupo grande ──
      if (form.guests > 15) {
        if (!data.data.hasAvailability) {
          const reason = data.data.reason;
          const msg = reason === "already_blocked_large_group"
            ? `El área ${form.sectionPreference} ya tiene una reserva de grupo grande ese día.`
            : `El área ${form.sectionPreference} ya tiene reservas para ese día y no puede reservarse completa. Elige otra área u otra fecha.`;
          setSearchError(msg);
          return;
        }
        setStep("large-confirm");
        return;
      }

      // ── Reserva normal ──
      if (!data.data.hasAvailability) {
        const msg = data.data.blockedByLargeGroup
          ? `El área ${form.sectionPreference} está reservada completa para ese día por un grupo grande. Elige otra área u otro día.`
          : `Sin disponibilidad en ${form.sectionPreference} para ese horario. Elige otra área u horario.`;
        setSearchError(msg);
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

  // ── Confirmar reserva normal (mapa) ───────────
  async function handleConfirm() {
    if (!selection) return;
    if (!checkAuth()) { setStep("form"); return; }
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
          tableId:        selection.tableId,
          linkedTableId:  selection.linkedTableId,
          thirdTableId:   selection.thirdTableId,
          fourthTableId:  selection.fourthTableId,
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

  // ── Confirmar reserva de grupo grande ─────────
  async function handleConfirmLargeGroup() {
    if (!checkAuth()) { setStep("form"); return; }
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
          isLargeGroup: true,
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
    ? selection.fourthTableNumber
      ? `Mesas M${selection.tableNumber} + M${selection.linkedTableNumber} + M${selection.thirdTableNumber} + M${selection.fourthTableNumber} (combinadas)`
      : selection.thirdTableNumber
      ? `Mesas M${selection.tableNumber} + M${selection.linkedTableNumber} + M${selection.thirdTableNumber} (combinadas)`
      : selection.linkedTableNumber
      ? `Mesas M${selection.tableNumber} + M${selection.linkedTableNumber} (combinadas)`
      : `Mesa M${selection.tableNumber}`
    : null;

  // ── Formato de fecha legible ──────────────────
  const readableDate = form.date
    ? new Date(`${form.date}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

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

        {/* ══════════════ PASO 1: FORMULARIO ══════════════ */}
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
                  style={{ colorScheme: "dark" }}
                  onChange={(e) => { set("date", e.target.value); set("time", ""); }} />
              </div>
              <div>
                <label className="rf-label">Hora</label>
                {isDayClosed ? (
                  <div className="rf-error" style={{ marginTop: 4 }}>Los lunes estamos cerrados.</div>
                ) : (
                  <GoldSelect
                    value={form.time}
                    onChange={(v) => set("time", v)}
                    disabled={!form.date}
                    placeholder={form.date ? "Selecciona hora" : "Elige fecha primero"}
                    options={timeSlots.map((t): SelectOption => ({
                      value: t,
                      label: t,
                      group: parseInt(t) < 14 ? "Brunch  ·  8:00 — 13:30" : "Cena  ·  14:00 — Cierre",
                    }))}
                  />
                )}
              </div>

              {/* ── Selector de personas ── */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="rf-label">Personas</label>
                {!largeGroupMode ? (
                  <GuestsPicker
                    value={form.guests}
                    onChange={(n) => set("guests", n)}
                    onLargeGroup={() => { setLargeGroupMode(true); setCustomGuestsInput(""); set("guests", 16); }}
                  />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className="rf-input"
                        type="number"
                        min={16}
                        max={500}
                        placeholder="Ej. 20 personas"
                        value={customGuestsInput}
                        onChange={(e) => {
                          setCustomGuestsInput(e.target.value);
                          const n = parseInt(e.target.value);
                          if (!isNaN(n) && n >= 16) set("guests", n);
                        }}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => { setLargeGroupMode(false); setCustomGuestsInput(""); set("guests", 2); }}
                        style={{ whiteSpace: "nowrap", padding: "0 12px", background: "transparent", border: "1px solid rgba(245,241,232,0.15)", borderRadius: 8, color: "rgba(245,241,232,0.4)", fontSize: "0.68rem", cursor: "pointer" }}
                      >
                        Cancelar
                      </button>
                    </div>
                    <p style={{ fontSize: "0.68rem", color: "rgba(186,132,60,0.75)", margin: 0, lineHeight: 1.4 }}>
                      Grupos de +15 personas reservan el área completa por todo el día.
                    </p>
                  </div>
                )}
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
              {searching ? "Verificando disponibilidad..." : "Buscar Disponibilidad"}
            </button>
          </>
        )}

        {/* ══════════════ PASO 2: MAPA DE MESAS (normal) ══════════════ */}
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

        {/* ══════════════ PASO 3: CONFIRMACIÓN GRUPO GRANDE ══════════════ */}
        {step === "large-confirm" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => setStep("form")}
                style={{ background: "none", border: "1px solid rgba(186,132,60,0.4)", borderRadius: 8, color: "rgba(245,241,232,0.7)", padding: "6px 14px", cursor: "pointer", fontSize: "0.75rem" }}
              >
                ← Volver
              </button>
              <div>
                <h2 className="rf-form-title" style={{ margin: 0 }}>Reserva de Grupo</h2>
                <p className="rf-form-sub" style={{ margin: 0 }}>{form.sectionPreference} · {form.guests} personas</p>
              </div>
            </div>

            <div className="rf-divider" />

            {/* Resumen */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Titular", form.guestName],
                ["Teléfono", form.guestPhone],
                ["Fecha", readableDate],
                ["Hora", form.time],
                ["Personas", `${form.guests} personas`],
                ["Área", form.sectionPreference],
                ...(form.notes ? [["Notas", form.notes] as [string, string]] : []),
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: "0.75rem", color: "rgba(245,241,232,0.4)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
                  <span style={{ fontSize: "0.82rem", color: "rgba(245,241,232,0.85)", textAlign: "right" }}>{value}</span>
                </div>
              ))}
            </div>

            <div className="rf-divider" />

            {/* Aviso exclusividad */}
            <div style={{
              background: "rgba(186,132,60,0.07)",
              border: "1px solid rgba(186,132,60,0.25)",
              borderRadius: 10,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}>
              <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 700, color: "#ba843c", letterSpacing: "0.04em" }}>
                RESERVA EXCLUSIVA DE ÁREA
              </p>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(245,241,232,0.65)", lineHeight: 1.6 }}>
                Al confirmar, el área completa de <strong style={{ color: "rgba(245,241,232,0.85)" }}>{form.sectionPreference}</strong> quedará bloqueada para tu grupo durante todo el{" "}
                <strong style={{ color: "rgba(245,241,232,0.85)" }}>{readableDate}</strong>.
              </p>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(245,241,232,0.5)", lineHeight: 1.6 }}>
                Ninguna otra reserva podrá realizarse en esa área ese día. Nuestro equipo acomodará el espacio para {form.guests} personas.
              </p>
            </div>

            {confirmError && <div className="rf-error">⚠ {confirmError}</div>}

            <button
              className="rf-submit"
              onClick={handleConfirmLargeGroup}
              disabled={confirming}
            >
              {confirming ? "Confirmando..." : `Confirmar Reserva para ${form.guests} Personas`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
