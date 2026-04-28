"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TableMap } from "@/components/reservation/TableMap";
import type { AvailabilityData, TableSelection } from "@/components/reservation/types";
import { GoldSelect } from "@/components/ui/GoldSelect";
import type { SelectOption } from "@/components/ui/GoldSelect";
import { GuestsPicker } from "@/components/ui/GuestsPicker";
import { DatePicker } from "@/components/ui/DatePicker";
import { useTranslation } from "@/lib/i18n";

const SECTIONS = ["Terraza", "Planta Alta", "Salón", "Privado"] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_IMAGES: Record<Section, string> = {
  "Terraza":    "/images/areas/terraza.jpg",
  "Planta Alta": "/images/areas/pAlta.jpg",
  "Salón":      "/images/areas/salon.jpg",
  "Privado":    "/images/areas/privado.jpg",
};

const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

interface FormData {
  guestName: string;
  guestPhone: string;
  date: string;
  time: string;
  guests: number;
  sectionPreference: Section;
  occasion: string;
  notes: string;
}

type Step = "form" | "map" | "large-confirm";

export function ReservationForm() {
  const router = useRouter();
  const { t } = useTranslation();

  const OCCASIONS: SelectOption[] = [
    { value: "",                 label: t.reservation.occasionNone        },
    { value: "Cumpleaños",       label: t.reservation.occasions.birthday    },
    { value: "Aniversario",      label: t.reservation.occasions.anniversary },
    { value: "Cena de negocios", label: t.reservation.occasions.business    },
    { value: "Pedida de mano",   label: t.reservation.occasions.proposal    },
    { value: "Otro",             label: t.reservation.occasions.other       },
  ];

  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormData>({
    guestName: "", guestPhone: "", date: "", time: "",
    guests: 2, sectionPreference: "Terraza", occasion: "", notes: "",
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
  const [specialDates, setSpecialDates] = useState<{ month: number; day: number; label: string; amount: number }[]>([]);
  const [creditAvailable, setCreditAvailable] = useState(0);
  const [paymentRedirecting, setPaymentRedirecting] = useState(false);

  const set = <K extends keyof FormData>(field: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Cargar fechas especiales una sola vez
  useEffect(() => {
    fetch("/api/special-dates")
      .then((r) => r.json())
      .then((d) => Array.isArray(d?.dates) && setSpecialDates(d.dates))
      .catch(() => {});
  }, []);

  // Lookup de crédito cuando hay phone + auth
  useEffect(() => {
    const phone = form.guestPhone.replace(/\D/g, "");
    if (phone.length < 10) { setCreditAvailable(0); return; }
    const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    if (!userId) { setCreditAvailable(0); return; }
    let cancelled = false;
    fetch(`/api/credits/lookup?phone=${encodeURIComponent(phone)}`, {
      headers: { "x-user-id": userId },
    })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setCreditAvailable(d?.amount ?? 0); })
      .catch(() => { if (!cancelled) setCreditAvailable(0); });
    return () => { cancelled = true; };
  }, [form.guestPhone]);

  // Detectar si la fecha seleccionada es especial
  const selectedSpecial = (() => {
    if (!form.date) return null;
    const [, mm, dd] = form.date.split("-").map((n) => parseInt(n, 10));
    return specialDates.find((s) => s.month === mm && s.day === dd) || null;
  })();
  const paymentDue = selectedSpecial
    ? Math.max(0, selectedSpecial.amount - creditAvailable)
    : 0;

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
          occasion: form.occasion || undefined,
          notes: form.notes || undefined,
          tableId:        selection.tableId,
          linkedTableId:  selection.linkedTableId,
          thirdTableId:   selection.thirdTableId,
          fourthTableId:  selection.fourthTableId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      if (data.data?.needsPayment && data.data?.initPoint) {
        setPaymentRedirecting(true);
        window.location.href = data.data.initPoint;
        return;
      }
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
          occasion: form.occasion || undefined,
          notes: form.notes || undefined,
          isLargeGroup: true,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      if (data.data?.needsPayment && data.data?.initPoint) {
        setPaymentRedirecting(true);
        window.location.href = data.data.initPoint;
        return;
      }
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
          <h1 className="rf-hero-title">{t.reservation.title}</h1>
          <p className="rf-hero-sub">{t.reservation.subtitle}</p>
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
                  {t.reservation.sections[sec]}
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
              <h2 className="rf-form-title">{t.reservation.formTitle}</h2>
              <p className="rf-form-sub">{t.reservation.formSubtitle}</p>
            </div>

            <div className="rf-divider" />

            <div>
              <label className="rf-label">{t.reservation.name}</label>
              <input className="rf-input" placeholder={t.reservation.namePlaceholder} value={form.guestName}
                onChange={(e) => set("guestName", e.target.value)} />
            </div>

            <div>
              <label className="rf-label">{t.reservation.phone}</label>
              <input className="rf-input" type="tel" placeholder={t.reservation.phonePlaceholder} value={form.guestPhone}
                onChange={(e) => set("guestPhone", e.target.value)} />
            </div>

            <div className="rf-row-three">
              <div>
                <label className="rf-label">{t.reservation.date}</label>
                <DatePicker
                  value={form.date}
                  onChange={(v) => { set("date", v); set("time", ""); }}
                  min={TODAY}
                  disabledDow={[1]}
                  placeholder={t.reservation.datePlaceholder}
                />
              </div>
              <div>
                <label className="rf-label">{t.reservation.time}</label>
                {isDayClosed ? (
                  <div className="rf-error" style={{ marginTop: 4 }}>{t.reservation.closedMonday}</div>
                ) : (
                  <GoldSelect
                    value={form.time}
                    onChange={(v) => set("time", v)}
                    disabled={!form.date}
                    placeholder={form.date ? t.reservation.timePlaceholder : t.reservation.timeDisabled}
                    options={timeSlots.map((slot): SelectOption => ({
                      value: slot,
                      label: slot,
                      group: parseInt(slot) < 14
                        ? `${t.menu.sectionTitles.brunch}  ·  8:00 — 13:30`
                        : `${t.menu.sectionTitles.cena}  ·  14:00 — Cierre`,
                    }))}
                  />
                )}
              </div>

              {/* ── Selector de personas ── */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="rf-label">{t.reservation.guests}</label>
                {!largeGroupMode ? (
                  <GuestsPicker
                    value={form.guests}
                    onChange={(n) => set("guests", n)}
                    onLargeGroup={() => { setLargeGroupMode(true); setCustomGuestsInput(""); set("guests", 16); }}
                    largeGroupLabel={t.reservation.largeGroupBtn}
                  />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className="rf-input"
                        type="number"
                        min={16}
                        max={500}
                        placeholder={t.reservation.largeGroupPlaceholder}
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
                        {t.reservation.largeGroupCancel}
                      </button>
                    </div>
                    <p style={{ fontSize: "0.68rem", color: "rgba(186,132,60,0.75)", margin: 0, lineHeight: 1.4 }}>
                      {t.reservation.largeGroupHint}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {selectedSpecial && (
              <div style={{
                background: "linear-gradient(135deg, rgba(186,132,60,0.18), rgba(186,132,60,0.08))",
                border: "1px solid rgba(186,132,60,0.5)",
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}>
                <div style={{ fontSize: "1.4rem", lineHeight: 1 }}>✨</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.8rem", color: "#ba843c", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
                    {selectedSpecial.label} · {t.reservation.specialDate.title}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "rgba(245,241,232,0.85)", lineHeight: 1.45 }}>
                    {t.reservation.specialDate.requires} <b>${selectedSpecial.amount.toFixed(0)} MXN</b> {t.reservation.specialDate.perReservation}
                    {creditAvailable > 0 && (
                      <>
                        {" "}{t.reservation.specialDate.youHave} <b style={{ color: "#ba843c" }}>${creditAvailable.toFixed(0)}</b> {t.reservation.specialDate.ofCredit}
                        {paymentDue > 0
                          ? ` ${t.reservation.specialDate.willPay} $${paymentDue.toFixed(0)} ${t.reservation.specialDate.withMP}`
                          : ` ${t.reservation.specialDate.autoApply}`}
                      </>
                    )}
                    {creditAvailable === 0 && ` ${t.reservation.specialDate.redirect}`}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="rf-label">{t.reservation.occasion}</label>
              <GoldSelect
                value={form.occasion}
                onChange={(v) => set("occasion", v)}
                options={OCCASIONS}
                placeholder={t.reservation.occasionNone}
              />
            </div>

            <div>
              <label className="rf-label">{t.reservation.notes}</label>
              <textarea className="rf-textarea" placeholder={t.reservation.notesPlaceholder}
                value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} />
            </div>

            {searchError && <div className="rf-error">⚠ {searchError}</div>}

            {authRequired && (
              <div style={{ background: "rgba(186,132,60,0.08)", border: "1px solid rgba(186,132,60,0.4)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ margin: "0 0 10px", fontSize: "0.8rem", color: "#f5f1e8", textAlign: "center" }}>
                  {t.reservation.authNeeded}
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => router.push("/login?redirect=/reservation")}
                    style={{ flex: 1, padding: "9px 0", background: "#ba843c", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", letterSpacing: "0.04em" }}
                  >
                    {t.nav.login}
                  </button>
                  <button
                    onClick={() => router.push("/register?redirect=/reservation")}
                    style={{ flex: 1, padding: "9px 0", background: "transparent", border: "1px solid rgba(186,132,60,0.5)", borderRadius: 8, color: "rgba(245,241,232,0.8)", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", letterSpacing: "0.04em" }}
                  >
                    {t.nav.register}
                  </button>
                </div>
              </div>
            )}

            <button className="rf-submit" onClick={handleSearch} disabled={searching || paymentRedirecting}>
              {searching
                ? t.reservation.searching
                : paymentRedirecting
                ? t.reservation.redirecting
                : t.reservation.searchBtn}
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
                ← {t.common.back}
              </button>
              <div>
                <h2 className="rf-form-title" style={{ margin: 0 }}>{t.reservation.confirm.summary}</h2>
                <p className="rf-form-sub" style={{ margin: 0 }}>{t.reservation.sections[form.sectionPreference]} · {form.guests} {t.dashboard.guestsLbl} · {form.date} {form.time}</p>
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
              {confirming ? t.reservation.confirm.confirming : t.reservation.confirm.confirmBtn}
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
                ← {t.common.back}
              </button>
              <div>
                <h2 className="rf-form-title" style={{ margin: 0 }}>{t.reservation.largeGroupConfirmTitle}</h2>
                <p className="rf-form-sub" style={{ margin: 0 }}>{t.reservation.sections[form.sectionPreference]} · {form.guests} {t.dashboard.guestsLbl}</p>
              </div>
            </div>

            <div className="rf-divider" />

            {/* Resumen */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                [t.reservation.name,  form.guestName],
                [t.reservation.phone, form.guestPhone],
                [t.reservation.date,  readableDate],
                [t.reservation.time,  form.time],
                [t.reservation.guests, `${form.guests} ${t.dashboard.guestsLbl}`],
                [t.dashboard.section, t.reservation.sections[form.sectionPreference]],
                ...(form.notes ? [[t.reservation.notes, form.notes] as [string, string]] : []),
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
                {t.reservation.largeGroupConfirmTitle.toUpperCase()}
              </p>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(245,241,232,0.65)", lineHeight: 1.6 }}>
                {t.reservation.largeGroupConfirmBody}
              </p>
            </div>

            {confirmError && <div className="rf-error">⚠ {confirmError}</div>}

            <button
              className="rf-submit"
              onClick={handleConfirmLargeGroup}
              disabled={confirming}
            >
              {confirming ? t.reservation.confirm.confirming : `${t.reservation.confirm.confirmBtn} · ${form.guests} ${t.dashboard.guestsLbl}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
