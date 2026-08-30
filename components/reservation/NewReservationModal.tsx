"use client";

import type React from "react";
import { useState } from "react";
import { TableMap } from "@/components/reservation/TableMap";
import { GoldSelect } from "@/components/ui/GoldSelect";
import type { SelectOption } from "@/components/ui/GoldSelect";
import { GuestsPicker } from "@/components/ui/GuestsPicker";
import { DatePicker } from "@/components/ui/DatePicker";
import { MX_TZ, OCCASION_OPTIONS } from "@/components/reservation/types";
import type { AvailabilityData, TableSelection } from "@/components/reservation/types";

const NR_SECTIONS  = ["Terraza", "Planta Alta", "Salón", "Privado"] as const;

const NR_SLOTS     = (() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const s: string[] = [];
    for (let h = 8; h < 24; h++) { s.push(`${pad(h)}:00`); s.push(`${pad(h)}:30`); }
    return s;
})();

type NRStep = "form" | "map" | "large-confirm";

export function NewReservationModal({
    onClose,
    onCreate,
}: {
    onClose: () => void;
    onCreate: (data: {
        guestName: string; guestPhone: string; date: string; time: string;
        guests: number; sectionPreference?: string; notes?: string; occasion?: string;
        isLargeGroup?: boolean; tableId?: string; linkedTableId?: string; thirdTableId?: string; fourthTableId?: string;
    }) => Promise<void>;
}) {
    const todayMx = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

    const [step,              setStep]              = useState<NRStep>("form");
    const [guestName,         setGuestName]         = useState("");
    const [guestPhone,        setGuestPhone]         = useState("");
    const [date,              setDate]               = useState(todayMx);
    const [time,              setTime]               = useState("13:00");
    const [guests,            setGuests]             = useState(2);
    const [largeGroupMode,    setLargeGroupMode]     = useState(false);
    const [customGuests,      setCustomGuests]       = useState("");
    const [section,           setSection]            = useState<string>("Terraza");
    const [occasion,          setOccasion]           = useState("");
    const [notes,             setNotes]              = useState("");
    const [availability,      setAvailability]       = useState<AvailabilityData | null>(null);
    const [selection,         setSelection]          = useState<TableSelection | null>(null);
    const [searching,         setSearching]          = useState(false);
    const [searchError,       setSearchError]        = useState<string | null>(null);
    const [saving,            setSaving]             = useState(false);
    const [saveError,         setSaveError]          = useState<string | null>(null);

    const fs: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "rgb(var(--sl-veil-rgb) / 0.05)", border: "1px solid rgb(var(--sl-veil-rgb) / 0.12)", borderRadius: 8, color: "var(--sl-cream)", fontSize: "0.85rem", boxSizing: "border-box" };
    const ls: React.CSSProperties = { display: "block", marginBottom: 6, fontSize: "0.65rem", letterSpacing: "0.15em", color: "rgb(var(--sl-cream-rgb) / 0.62)", textTransform: "uppercase", fontWeight: 700 };

    const readableDate = date ? new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: MX_TZ }) : "";

    const handleSearch = async () => {
        setSearchError(null);
        if (!guestName.trim() || !guestPhone.trim() || !date || !time) {
            setSearchError("Completa nombre, celular, fecha y hora.");
            return;
        }
        setSearching(true);
        try {
            const params = new URLSearchParams({ section, date, time, guests: String(guests) });
            const res  = await fetch(`/api/reservations/available-tables?${params}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            if (guests > 15) {
                if (!data.data.hasAvailability) {
                    setSearchError(`El área ${section} ya tiene una reserva de grupo grande ese día.`);
                    return;
                }
                setStep("large-confirm");
            } else {
                setAvailability(data.data);
                setSelection(null);
                setStep("map");
            }
        } catch (e: unknown) {
            setSearchError(e instanceof Error ? e.message : "Error al buscar disponibilidad");
        } finally {
            setSearching(false);
        }
    };

    const doCreate = async (extra: { isLargeGroup?: boolean; tableId?: string; linkedTableId?: string; thirdTableId?: string; fourthTableId?: string }) => {
        setSaveError(null);
        setSaving(true);
        try {
            await onCreate({
                guestName: guestName.trim(), guestPhone: guestPhone.trim(),
                date, time, guests,
                sectionPreference: section || undefined,
                occasion: occasion || undefined,
                notes:    notes.trim() || undefined,
                ...extra,
            });
        } catch (e: unknown) {
            setSaveError(e instanceof Error ? e.message : "Error al crear reserva");
            setSaving(false);
        }
    };

    const selLabel = selection
        ? selection.fourthTableNumber
            ? `M${selection.tableNumber} + M${selection.linkedTableNumber} + M${selection.thirdTableNumber} + M${selection.fourthTableNumber}`
            : selection.thirdTableNumber
            ? `M${selection.tableNumber} + M${selection.linkedTableNumber} + M${selection.thirdTableNumber}`
            : selection.linkedTableNumber
            ? `M${selection.tableNumber} + M${selection.linkedTableNumber}`
            : `Mesa M${selection.tableNumber}`
        : null;

    const btnBack  = { background: "none", border: "1px solid rgb(var(--sl-gold-rgb) / 0.4)", borderRadius: 8, color: "rgb(var(--sl-cream-rgb) / 0.7)", padding: "6px 14px", cursor: "pointer", fontSize: "0.75rem" } as const;
    const btnCancel = { flex: 1, padding: "11px 0", background: "transparent", border: "1px solid rgb(var(--sl-veil-rgb) / 0.12)", borderRadius: 10, color: "rgb(var(--sl-cream-rgb) / 0.5)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" } as const;
    const btnPrimary = (disabled?: boolean) => ({ flex: 2, padding: "11px 0", background: disabled ? "rgb(var(--sl-gold-rgb) / 0.2)" : "var(--sl-gold)", border: "none", borderRadius: 10, color: disabled ? "rgb(var(--sl-cream-rgb) / 0.6)" : "#fff", fontWeight: 700, fontSize: "0.82rem", cursor: disabled ? "default" : "pointer", letterSpacing: "0.06em", textTransform: "uppercase" as const });

    return (
        <div
            style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{ background: "var(--sl-panel)", border: "1px solid rgb(var(--sl-gold-rgb) / 0.25)", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {step !== "form" && (
                            <button style={btnBack} onClick={() => { setStep("form"); setAvailability(null); setSelection(null); }}>← Volver</button>
                        )}
                        <div>
                            <p style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.2em", color: "var(--sl-gold)", fontWeight: 700, textTransform: "uppercase" }}>Nueva Reserva</p>
                            <p style={{ margin: "3px 0 0", fontSize: "0.95rem", color: "var(--sl-cream)", fontWeight: 700 }}>
                                {step === "form" ? "Datos de la reserva" : step === "map" ? "Seleccionar mesa" : "Confirmar grupo grande"}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "1px solid rgb(var(--sl-veil-rgb) / 0.12)", borderRadius: 8, color: "rgb(var(--sl-cream-rgb) / 0.5)", padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem" }}>✕</button>
                </div>

                {/* ── PASO 1: FORMULARIO ── */}
                {step === "form" && (<>
                    {/* Nombre + Celular */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <label>
                            <span style={ls}>Nombre *</span>
                            <input style={fs} value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Titular" />
                        </label>
                        <label>
                            <span style={ls}>Celular *</span>
                            <input style={fs} type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="10 dígitos" />
                        </label>
                    </div>

                    {/* Fecha + Hora */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                            <span style={ls}>Fecha *</span>
                            <DatePicker value={date} onChange={setDate} placeholder="Selecciona fecha" />
                        </div>
                        <div>
                            <span style={ls}>Hora *</span>
                            <GoldSelect
                                value={time}
                                onChange={setTime}
                                placeholder="Selecciona hora"
                                options={NR_SLOTS.map((s): SelectOption => ({
                                    value: s,
                                    label: s,
                                    group: parseInt(s) < 14 ? "Brunch  ·  8:00 — 13:30" : "Cena  ·  14:00 — Cierre",
                                }))}
                            />
                        </div>
                    </div>

                    {/* Personas */}
                    <div>
                        <span style={ls}>Personas *</span>
                        {!largeGroupMode ? (
                            <GuestsPicker
                                value={guests}
                                onChange={setGuests}
                                onLargeGroup={() => { setLargeGroupMode(true); setCustomGuests(""); setGuests(16); }}
                            />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <input style={{ ...fs, flex: 1 }} type="number" min={16} placeholder="Ej. 20" value={customGuests}
                                        onChange={(e) => { setCustomGuests(e.target.value); const n = parseInt(e.target.value); if (!isNaN(n) && n >= 16) setGuests(n); }} />
                                    <button type="button" onClick={() => { setLargeGroupMode(false); setCustomGuests(""); setGuests(2); }}
                                        style={{ whiteSpace: "nowrap", padding: "0 12px", background: "transparent", border: "1px solid rgb(var(--sl-cream-rgb) / 0.15)", borderRadius: 8, color: "rgb(var(--sl-cream-rgb) / 0.62)", fontSize: "0.7rem", cursor: "pointer" }}>
                                        Cancelar
                                    </button>
                                </div>
                                <p style={{ margin: 0, fontSize: "0.68rem", color: "rgb(var(--sl-gold-rgb) / 0.75)", lineHeight: 1.4 }}>Grupos de +15 personas reservan el área completa en su horario (ventana de ±3½ h), no todo el día.</p>
                            </div>
                        )}
                    </div>

                    {/* Sección */}
                    <div>
                        <span style={ls}>Área</span>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {NR_SECTIONS.map((s) => (
                                <button key={s} onClick={() => setSection(s)}
                                    style={{ padding: "7px 16px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                                        background: section === s ? "var(--sl-gold)" : "transparent",
                                        border: `1px solid ${section === s ? "var(--sl-gold)" : "rgb(var(--sl-veil-rgb) / 0.15)"}`,
                                        color: section === s ? "#fff" : "rgb(var(--sl-cream-rgb) / 0.6)" }}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Ocasión */}
                    <div>
                        <span style={ls}>¿Qué festejamos?</span>
                        <GoldSelect
                            value={occasion}
                            onChange={setOccasion}
                            options={OCCASION_OPTIONS}
                            placeholder="— Sin celebración —"
                        />
                    </div>

                    {/* Notas */}
                    <label>
                        <span style={ls}>Solicitud especial</span>
                        <textarea style={{ ...fs, resize: "vertical", minHeight: 68 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alergias, decoración, peticiones especiales…" />
                    </label>

                    {searchError && <p style={{ margin: 0, color: "var(--sl-danger)", fontSize: "0.82rem" }}>⚠ {searchError}</p>}

                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={onClose} style={btnCancel}>Cancelar</button>
                        <button onClick={handleSearch} disabled={searching} style={btnPrimary(searching)}>
                            {searching ? "Verificando…" : "Buscar Disponibilidad"}
                        </button>
                    </div>
                </>)}

                {/* ── PASO 2: MAPA DE MESAS ── */}
                {step === "map" && availability && (<>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "rgb(var(--sl-cream-rgb) / 0.65)" }}>
                        {section} · {guests} {guests === 1 ? "persona" : "personas"} · {date} {time}
                    </p>
                    <TableMap data={availability} guests={guests} selection={selection} onSelect={setSelection} />
                    {selLabel && <p style={{ margin: 0, textAlign: "center", color: "var(--sl-gold)", fontSize: "0.85rem", fontWeight: 600 }}>{selLabel}</p>}
                    {!availability.hasAvailability && <p style={{ margin: 0, color: "var(--sl-danger)", fontSize: "0.82rem", textAlign: "center" }}>Sin mesas disponibles en {section} para ese horario.</p>}
                    {saveError && <p style={{ margin: 0, color: "var(--sl-danger)", fontSize: "0.82rem" }}>⚠ {saveError}</p>}
                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={onClose} style={btnCancel}>Cancelar</button>
                        <button disabled={!selection || saving} onClick={() => doCreate({ tableId: selection?.tableId, linkedTableId: selection?.linkedTableId, thirdTableId: selection?.thirdTableId, fourthTableId: selection?.fourthTableId })} style={btnPrimary(!selection || saving)}>
                            {saving ? "Creando…" : "Confirmar Reserva"}
                        </button>
                    </div>
                </>)}

                {/* ── PASO 3: GRUPO GRANDE ── */}
                {step === "large-confirm" && (<>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "rgb(var(--sl-cream-rgb) / 0.65)" }}>{section} · {guests} personas · {date} {time}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {([["Titular", guestName], ["Teléfono", guestPhone], ["Fecha", readableDate], ["Hora", time], ["Personas", `${guests} personas`], ["Área", section], ...(notes ? [["Notas", notes]] : [])] as [string,string][]).map(([l, v]) => (
                            <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                <span style={{ fontSize: "0.72rem", color: "rgb(var(--sl-cream-rgb) / 0.62)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{l}</span>
                                <span style={{ fontSize: "0.82rem", color: "rgb(var(--sl-cream-rgb) / 0.85)", textAlign: "right" }}>{v}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ background: "rgb(var(--sl-gold-rgb) / 0.07)", border: "1px solid rgb(var(--sl-gold-rgb) / 0.25)", borderRadius: 10, padding: "14px 16px" }}>
                        <p style={{ margin: "0 0 6px", fontSize: "0.75rem", fontWeight: 700, color: "var(--sl-gold)", letterSpacing: "0.04em" }}>RESERVA EXCLUSIVA DE ÁREA</p>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "rgb(var(--sl-cream-rgb) / 0.65)", lineHeight: 1.6 }}>
                            El área completa de <strong style={{ color: "rgb(var(--sl-cream-rgb) / 0.85)" }}>{section}</strong> queda en exclusiva para el grupo en su horario del <strong style={{ color: "rgb(var(--sl-cream-rgb) / 0.85)" }}>{readableDate}</strong> — unas 3½ horas antes y después de la hora reservada. Fuera de ese lapso, el área sigue disponible para otras reservas.
                        </p>
                    </div>
                    {saveError && <p style={{ margin: 0, color: "var(--sl-danger)", fontSize: "0.82rem" }}>⚠ {saveError}</p>}
                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={onClose} style={btnCancel}>Cancelar</button>
                        <button disabled={saving} onClick={() => doCreate({ isLargeGroup: true })} style={btnPrimary(saving)}>
                            {saving ? "Creando…" : `Confirmar — ${guests} Personas`}
                        </button>
                    </div>
                </>)}
            </div>
        </div>
    );
}
