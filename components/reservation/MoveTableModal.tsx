"use client";

import { useState, useEffect, useCallback } from "react";
import { TableMap } from "@/components/reservation/TableMap";
import { MX_TZ, MODAL_SECTIONS } from "@/components/reservation/types";
import type { AvailabilityData, TableSelection, Reservation } from "@/components/reservation/types";
import { tableFitsGuests } from "@/lib/tableCapacity";

export function MoveTableModal({
    reservation,
    userId,
    onClose,
    onMove,
}: {
    reservation: Reservation;
    userId: string;
    onClose: () => void;
    onMove: (selection: TableSelection | null, sectionPref: string, forceAssign?: boolean) => Promise<void>;
}) {
    const date    = new Date(reservation.date).toLocaleDateString("en-CA", { timeZone: MX_TZ });
    const time    = new Date(reservation.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: MX_TZ });
    const initSec = (reservation.sectionPreference ?? "Terraza") as typeof MODAL_SECTIONS[number];

    const [selectedSection, setSelectedSection] = useState<string>(initSec);
    const [availability, setAvailability]       = useState<AvailabilityData | null>(null);
    const [selection, setSelection]             = useState<TableSelection | null>(null);
    const [loading, setLoading]                 = useState(false);
    const [error, setError]                     = useState<string | null>(null);
    const [saving, setSaving]                   = useState(false);

    const fetchAvailability = useCallback(async (sec: string) => {
        setLoading(true);
        setError(null);
        setSelection(null);
        setAvailability(null);
        try {
            const params = new URLSearchParams({ section: sec, date, time, guests: String(reservation.guests) });
            const res  = await fetch(`/api/reservations/available-tables?${params}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            // Forzar que la mesa actual quede disponible visualmente (ya se excluye en el backend)
            const av: AvailabilityData = data.data;
            setAvailability(av);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Error al buscar mesas");
        } finally {
            setLoading(false);
        }
    }, [date, time, reservation.guests]);

    useEffect(() => { fetchAvailability(selectedSection); }, [selectedSection, fetchAvailability]);

    const isLargeGroupReady = !!(availability?.isLargeGroup && availability?.hasAvailability);

    // Override de capacidad: si la(s) mesa(s) elegida(s) no cubren a los
    // comensales, se pide confirmación antes de mandar forceAssign:true.
    const [capacityWarn, setCapacityWarn] = useState<{ totalCap: number } | null>(null);

    const submit = async (force: boolean) => {
        setSaving(true);
        setError(null);
        setCapacityWarn(null);
        try {
            await onMove(selection, selectedSection, force);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Error al mover mesa");
            setSaving(false);
        }
    };

    const handleConfirm = () => {
        if (!selection && !isLargeGroupReady) return;
        // Pre-check de capacidad usando los cupos del mapa de disponibilidad.
        if (selection && availability?.tables) {
            const ids = [selection.tableId, selection.linkedTableId, selection.thirdTableId, selection.fourthTableId]
                .filter(Boolean) as string[];
            const totalCap = ids.reduce(
                (sum, id) => sum + (availability.tables!.find((t) => t.id === id)?.capacity ?? 0),
                0,
            );
            if (totalCap > 0 && !tableFitsGuests(totalCap, reservation.guests)) {
                setCapacityWarn({ totalCap });
                return;
            }
        }
        submit(false);
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

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 1000,
                background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "16px",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                background: "#1a2628", border: "1px solid rgba(186,132,60,0.2)",
                borderRadius: 16, width: "100%", maxWidth: 680,
                maxHeight: "90vh", overflowY: "auto",
                padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20,
            }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <p style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.2em", color: "#ba843c", fontWeight: 700, textTransform: "uppercase" }}>
                            Cambiar Mesa
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: "1rem", color: "#f5f1e8", fontWeight: 700 }}>
                            {reservation.guestName}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "rgba(245,241,232,0.65)" }}>
                            {reservation.guests} personas · {date} {time}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(245,241,232,0.5)", padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                        ✕ Cerrar
                    </button>
                </div>

                {/* Selector de área */}
                <div>
                    <p style={{ margin: "0 0 10px", fontSize: "0.65rem", letterSpacing: "0.15em", color: "rgba(245,241,232,0.62)", textTransform: "uppercase", fontWeight: 700 }}>
                        Área
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {MODAL_SECTIONS.map((sec) => (
                            <button
                                key={sec}
                                onClick={() => setSelectedSection(sec)}
                                style={{
                                    padding: "7px 16px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                                    background: selectedSection === sec ? "#ba843c" : "transparent",
                                    border: `1px solid ${selectedSection === sec ? "#ba843c" : "rgba(255,255,255,0.15)"}`,
                                    color: selectedSection === sec ? "#fff" : "rgba(245,241,232,0.6)",
                                    transition: "all 0.2s",
                                }}
                            >
                                {sec}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mapa de mesas */}
                <div>
                    {loading && (
                        <p style={{ textAlign: "center", color: "rgba(245,241,232,0.62)", fontSize: "0.85rem" }}>Cargando mesas…</p>
                    )}
                    {!loading && availability && !availability.isLargeGroup && (
                        <TableMap
                            data={availability}
                            guests={reservation.guests}
                            selection={selection}
                            onSelect={setSelection}
                        />
                    )}
                    {!loading && availability?.isLargeGroup && (
                        <p style={{ textAlign: "center", color: availability.hasAvailability ? "#ba843c" : "#e8766b", fontSize: "0.85rem", margin: "12px 0" }}>
                            {availability.hasAvailability
                                ? `✓ Área ${selectedSection} disponible para grupo grande. Se asignará el área completa.`
                                : `✗ El área ${selectedSection} ya está bloqueada por otro grupo grande ese día.`}
                        </p>
                    )}
                    {!loading && availability && !availability.hasAvailability && !availability.isLargeGroup && (
                        <p style={{ textAlign: "center", color: "#e8766b", fontSize: "0.82rem", margin: "12px 0 0" }}>
                            Sin mesas disponibles en {selectedSection} para este turno.
                        </p>
                    )}
                </div>

                {selLabel && (
                    <p style={{ textAlign: "center", color: "#ba843c", fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>
                        Seleccionada: {selLabel}
                    </p>
                )}

                {error && (
                    <p style={{ color: "#e8766b", fontSize: "0.82rem", margin: 0 }}>⚠ {error}</p>
                )}

                {/* Acciones */}
                <div style={{ display: "flex", gap: 10 }}>
                    <button
                        onClick={onClose}
                        style={{ flex: 1, padding: "11px 0", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "rgba(245,241,232,0.5)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={(!selection && !isLargeGroupReady) || saving}
                        style={{
                            flex: 2, padding: "11px 0", background: (selection || isLargeGroupReady) ? "#ba843c" : "rgba(186,132,60,0.2)",
                            border: "none", borderRadius: 10, color: (selection || isLargeGroupReady) ? "#fff" : "rgba(245,241,232,0.6)",
                            fontWeight: 700, fontSize: "0.82rem", cursor: (selection || isLargeGroupReady) ? "pointer" : "default",
                            letterSpacing: "0.06em", textTransform: "uppercase",
                        }}
                    >
                        {saving ? "Guardando…" : "Confirmar Cambio"}
                    </button>
                </div>

                {/* Confirmación de override de capacidad */}
                {capacityWarn && (
                    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                        <div style={{ background: "#22302e", border: "1px solid rgba(186,132,60,0.4)", borderRadius: 14, padding: "24px 22px", maxWidth: 380, width: "100%" }}>
                            <p style={{ margin: 0, fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#ba843c", fontWeight: 700 }}>Capacidad insuficiente</p>
                            <p style={{ margin: "10px 0 0", color: "#f5f1e8", fontSize: "0.92rem", lineHeight: 1.5 }}>
                                Esta mesa es para <b>{capacityWarn.totalCap}</b> personas, vas a sentar <b>{reservation.guests}</b>. ¿Continuar?
                            </p>
                            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                                <button onClick={() => setCapacityWarn(null)} style={{ flex: 1, padding: "10px 0", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 9, color: "rgba(245,241,232,0.6)", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer" }}>Cancelar</button>
                                <button onClick={() => submit(true)} disabled={saving} style={{ flex: 1, padding: "10px 0", background: "#ba843c", border: "none", borderRadius: 9, color: "#fff", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>Sí, continuar</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
