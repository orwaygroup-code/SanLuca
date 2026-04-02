"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const STATUS_LABEL: Record<string, string> = {
    PENDING: "Pendiente",
    CONFIRMED: "Confirmada",
    CANCELLED: "Cancelada",
    COMPLETED: "Check-in realizado",
    NO_SHOW: "No se presentó",
};

const STATUS_CLASS: Record<string, string> = {
    PENDING: "dash-badge--pending",
    CONFIRMED: "dash-badge--confirmed",
    CANCELLED: "dash-badge--cancelled",
    COMPLETED: "dash-badge--completed",
    NO_SHOW: "dash-badge--noshow",
};

interface Reservation {
    id: string;
    guestName: string;
    guestPhone: string;
    date: string;
    guests: number;
    sectionPreference: string | null;
    occasion: string | null;
    notes: string | null;
    status: string;
    paymentStatus: string;
    checkedInAt: string | null;
    table: { number: number; section: { name: string } } | null;
    user: { name: string; email: string; phone: string };
}

export default function CheckinPage() {
    const { token } = useParams<{ token: string }>();
    const [reservation, setReservation] = useState<Reservation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [done, setDone] = useState(false);
    const [isHostes, setIsHostes] = useState(false);

    useEffect(() => {
        setIsHostes(localStorage.getItem("userRole") === "HOSTES");
        fetch(`/api/checkin/${token}`)
            .then((r) => r.json())
            .then((data) => {
                if (!data.success) throw new Error(data.error);
                setReservation(data.data);
                if (data.data.status === "COMPLETED") setDone(true);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [token]);

    const handleCheckin = async () => {
        setConfirming(true);
        try {
            const userId = localStorage.getItem("userId") ?? "";
            const res = await fetch(`/api/checkin/${token}`, {
                method: "PATCH",
                headers: { "x-user-id": userId },
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setReservation(data.data);
            setDone(true);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Error al confirmar");
        } finally {
            setConfirming(false);
        }
    };

    if (loading) {
        return (
            <div className="ci-page">
                <div className="ci-logo">SAN<br />LUCA</div>
                <p className="ci-loading">Cargando reserva…</p>
            </div>
        );
    }

    if (error || !reservation) {
        return (
            <div className="ci-page">
                <div className="ci-logo">SAN<br />LUCA</div>
                <div className="ci-error-box">
                    <span className="ci-error-icon">⚠</span>
                    <p>{error ?? "Reserva no encontrada"}</p>
                </div>
            </div>
        );
    }

    const date = new Date(reservation.date);
    const canCheckin = ["PENDING", "CONFIRMED"].includes(reservation.status);

    return (
        <div className="ci-page">
            <div className="ci-logo">SAN<br />LUCA</div>

            {/* Success banner */}
            {done && (
                <div className="ci-success-banner">
                    <span className="ci-success-icon">✓</span>
                    <span>Check-in confirmado</span>
                </div>
            )}

            {/* Status + date */}
            <div className="ci-card">
                <div className={`dash-badge ${STATUS_CLASS[reservation.status] ?? ""}`}>
                    {STATUS_LABEL[reservation.status] ?? reservation.status}
                </div>

                <div className="ci-date">
                    {date.toLocaleDateString("es-MX", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                    })}
                </div>
                <div className="ci-time">
                    {date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                </div>

                <div className="ci-divider" />

                {/* Guest info */}
                <div className="ci-section-title">Titular de la reserva</div>
                <div className="ci-row">
                    <span className="ci-label">Nombre</span>
                    <span className="ci-val">{reservation.guestName}</span>
                </div>
                <div className="ci-row">
                    <span className="ci-label">Celular</span>
                    <span className="ci-val">{reservation.guestPhone}</span>
                </div>
                <div className="ci-row">
                    <span className="ci-label">Personas</span>
                    <span className="ci-val">{reservation.guests}</span>
                </div>

                {reservation.sectionPreference && (
                    <div className="ci-row">
                        <span className="ci-label">Sección preferida</span>
                        <span className="ci-val">{reservation.sectionPreference}</span>
                    </div>
                )}

                {reservation.table && (
                    <div className="ci-row">
                        <span className="ci-label">Mesa asignada</span>
                        <span className="ci-val ci-val--highlight">
                            #{reservation.table.number} — {reservation.table.section.name}
                        </span>
                    </div>
                )}

                {reservation.occasion && (
                    <div className="ci-row">
                        <span className="ci-label">Ocasión</span>
                        <span className="ci-val">{reservation.occasion}</span>
                    </div>
                )}

                {reservation.notes && (
                    <>
                        <div className="ci-divider" />
                        <div className="ci-section-title">Notas especiales</div>
                        <p className="ci-notes">{reservation.notes}</p>
                    </>
                )}

                <div className="ci-divider" />

                {/* Account info */}
                <div className="ci-section-title">Cuenta</div>
                <div className="ci-row">
                    <span className="ci-label">Usuario</span>
                    <span className="ci-val">{reservation.user.name}</span>
                </div>
                <div className="ci-row">
                    <span className="ci-label">Email</span>
                    <span className="ci-val">{reservation.user.email}</span>
                </div>

                <div className="ci-row">
                    <span className="ci-label">Pago</span>
                    <span className={`ci-val dash-pay--${reservation.paymentStatus.toLowerCase()}`}>
                        {reservation.paymentStatus === "UNPAID" ? "Pendiente"
                            : reservation.paymentStatus === "PAID" ? "Pagado"
                                : reservation.paymentStatus === "REFUNDED" ? "Reembolsado"
                                    : "Parcial"}
                    </span>
                </div>

                {reservation.checkedInAt && (
                    <div className="ci-row">
                        <span className="ci-label">Check-in a las</span>
                        <span className="ci-val">
                            {new Date(reservation.checkedInAt).toLocaleTimeString("es-MX", {
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </span>
                    </div>
                )}
            </div>

            {/* Check-in button — solo Hostess */}
            {canCheckin && !done && (
                isHostes ? (
                    <button
                        className="ci-btn"
                        onClick={handleCheckin}
                        disabled={confirming}
                    >
                        {confirming ? "Confirmando…" : "✓ Confirmar llegada"}
                    </button>
                ) : (
                    <a
                        className="ci-btn"
                        href={`/login?mode=login&redirect=/checkin/${token}`}
                        style={{ textDecoration: "none", textAlign: "center" }}
                    >
                        Inicia sesión como Hostess para hacer check-in
                    </a>
                )
            )}
        </div>
    );
}
