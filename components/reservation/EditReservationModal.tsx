"use client";

import type React from "react";
import { useState } from "react";
import { GoldSelect } from "@/components/ui/GoldSelect";
import type { SelectOption } from "@/components/ui/GoldSelect";
import { GuestsPicker } from "@/components/ui/GuestsPicker";
import { DatePicker } from "@/components/ui/DatePicker";
import { MX_TZ, OCCASION_OPTIONS, MODAL_SECTIONS } from "@/components/reservation/types";
import type { Reservation } from "@/components/reservation/types";

type EditData = {
    date: string; time: string; guests: number;
    guestName: string; guestPhone: string; sectionPreference?: string;
    tableId?: string; linkedTableId?: string; thirdTableId?: string; fourthTableId?: string;
    notes?: string; occasion?: string;
};

export function EditReservationModal({
    reservation,
    onClose,
    onSave,
}: {
    reservation: Reservation;
    onClose: () => void;
    onSave: (data: EditData) => Promise<void>;
}) {
    const initDate = new Date(reservation.date).toLocaleDateString("en-CA", { timeZone: MX_TZ });
    const initTime = new Date(reservation.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: MX_TZ });

    const [guestName,   setGuestName]   = useState(reservation.guestName);
    const [guestPhone,  setGuestPhone]  = useState(reservation.guestPhone);
    const [date,        setDate]        = useState(initDate);
    const [time,        setTime]        = useState(initTime);

    const { timeSlots, isDayClosed } = (() => {
        if (!date) return { timeSlots: [] as string[], isDayClosed: false };
        const [y, mo, d] = date.split("-").map(Number);
        const dow = new Date(y, mo - 1, d).getDay();
        if (dow === 1) return { timeSlots: [] as string[], isDayClosed: true };
        const closeHour = dow === 0 ? 21 : (dow === 5 || dow === 6) ? 24 : 23;
        const slots: string[] = [];
        const pad = (n: number) => String(n).padStart(2, "0");
        for (let h = 8; h < closeHour; h++) { slots.push(`${pad(h)}:00`); slots.push(`${pad(h)}:30`); }
        if (closeHour < 24) slots.push(`${pad(closeHour)}:00`);
        return { timeSlots: slots, isDayClosed: false };
    })();
    const [guests,      setGuests]      = useState(reservation.guests);
    const [section,     setSection]     = useState<string>(reservation.sectionPreference ?? "Terraza");
    const [notes,       setNotes]       = useState(reservation.notes ?? "");
    const [occasion,    setOccasion]    = useState(reservation.occasion ?? "");

    const [saving,       setSaving]       = useState(false);
    const [error,        setError]        = useState<string | null>(null);

    // Fase A: el modal de editar ya NO muestra el mapa de mesas ni auto-asigna.
    // Editar preserva la mesa actual; la mesa se cambia solo desde "Cambiar Mesa".

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            await onSave({
                date, time, guests, guestName, guestPhone,
                sectionPreference: section || undefined,
                notes:              notes    || undefined,
                occasion:           occasion || undefined,
            });
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Error al guardar");
            setSaving(false);
        }
    };

    const inp: React.CSSProperties = {
        width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.05)", color: "#f5f1e8", fontSize: "0.85rem", boxSizing: "border-box",
    };
    const lbl: React.CSSProperties = {
        fontSize: "0.65rem", letterSpacing: "0.15em", color: "rgba(245,241,232,0.62)",
        textTransform: "uppercase", fontWeight: 700, marginBottom: 5, display: "block",
    };

    return (
        <div
            style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{ background: "#1a2628", border: "1px solid rgba(186,132,60,0.2)", borderRadius: 16, width: "100%", maxWidth: 700, maxHeight: "92vh", overflowY: "auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <p style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.2em", color: "#ba843c", fontWeight: 700, textTransform: "uppercase" }}>Editar Reserva</p>
                        <p style={{ margin: "4px 0 0", fontSize: "1rem", color: "#f5f1e8", fontWeight: 700 }}>{reservation.guestName}</p>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(245,241,232,0.5)", padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem" }}>✕</button>
                </div>

                {/* Datos del titular */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                        <label style={lbl}>Titular</label>
                        <input style={inp} value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                    </div>
                    <div>
                        <label style={lbl}>Celular</label>
                        <input style={inp} value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
                    </div>
                </div>

                {/* Fecha, hora, personas */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                        <label style={lbl}>Fecha</label>
                        <DatePicker value={date} onChange={(v) => { setDate(v); setTime(""); }} placeholder="Selecciona fecha" />
                    </div>
                    <div>
                        <label style={lbl}>Hora</label>
                        {isDayClosed ? (
                            <p style={{ color: "#e8766b", fontSize: "0.8rem", margin: "6px 0 0" }}>Lunes cerrado</p>
                        ) : (
                            <GoldSelect
                                value={time}
                                onChange={setTime}
                                disabled={!date}
                                placeholder={date ? "Selecciona hora" : "Elige fecha primero"}
                                options={timeSlots.map((t): SelectOption => ({
                                    value: t,
                                    label: t,
                                    group: parseInt(t) < 14 ? "Brunch  ·  8:00 — 13:30" : "Cena  ·  14:00 — Cierre",
                                }))}
                            />
                        )}
                    </div>
                </div>
                <div>
                    <label style={lbl}>Personas</label>
                    {guests <= 15 ? (
                        <GuestsPicker
                            value={guests}
                            onChange={setGuests}
                            onLargeGroup={() => setGuests(16)}
                        />
                    ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                            <input type="number" min={16} max={500} style={{ ...inp, flex: 1 }} value={guests} onChange={(e) => setGuests(parseInt(e.target.value) || 16)} />
                            <button type="button" onClick={() => setGuests(2)} style={{ whiteSpace: "nowrap", padding: "0 12px", background: "transparent", border: "1px solid rgba(245,241,232,0.15)", borderRadius: 8, color: "rgba(245,241,232,0.62)", fontSize: "0.7rem", cursor: "pointer" }}>← Volver</button>
                        </div>
                    )}
                </div>

                {/* Notas y ocasión */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                        <label style={lbl}>¿Qué festejamos?</label>
                        <GoldSelect
                            value={occasion}
                            onChange={setOccasion}
                            options={OCCASION_OPTIONS}
                            placeholder="— Sin celebración —"
                        />
                    </div>
                    <div>
                        <label style={lbl}>Notas</label>
                        <input style={inp} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Peticiones especiales…" />
                    </div>
                </div>

                {/* Selector de sección */}
                <div>
                    <p style={lbl}>Área</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {MODAL_SECTIONS.map((sec) => (
                            <button key={sec} onClick={() => setSection(sec)} style={{ padding: "7px 16px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", background: section === sec ? "#ba843c" : "transparent", border: `1px solid ${section === sec ? "#ba843c" : "rgba(255,255,255,0.15)"}`, color: section === sec ? "#fff" : "rgba(245,241,232,0.6)" }}>
                                {sec}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mesa: NO se cambia desde aquí. Editar preserva la mesa actual;
                    para reubicar la reserva usar el botón "Cambiar Mesa". */}
                <p style={{ ...lbl, marginBottom: 0, color: "rgba(245,241,232,0.38)", textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>
                    La mesa asignada no cambia al editar. Usa <b style={{ color: "rgba(245,241,232,0.6)" }}>“Cambiar Mesa”</b> para reubicar la reserva.
                </p>

                {error && <p style={{ color: "#e8766b", fontSize: "0.82rem", margin: 0 }}>⚠ {error}</p>}

                {/* Acciones */}
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: "11px 0", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "rgba(245,241,232,0.5)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "11px 0", background: "#ba843c", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: "0.82rem", cursor: saving ? "default" : "pointer", letterSpacing: "0.06em", textTransform: "uppercase", opacity: saving ? 0.6 : 1 }}>
                        {saving ? "Guardando…" : "Guardar Cambios"}
                    </button>
                </div>
            </div>
        </div>
    );
}
