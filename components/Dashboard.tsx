"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation, type Locale } from "@/lib/i18n";

const MAX_ACTIVE = 2;
const ACTIVE_STATUSES = ["PENDING", "PENDING_PAYMENT", "CONFIRMED"];

const LOCALE_TO_BCP47: Record<Locale, string> = {
    es: "es-MX", en: "en-US", ja: "ja-JP", zh: "zh-CN", de: "de-DE",
};

const STATUS_CLASS: Record<string, string> = {
    PENDING: "dash-badge--pending",
    PENDING_PAYMENT: "dash-badge--pending",
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
    qrToken: string;
    table: { number: number; section: { name: string } } | null;
}

export function Dashboard() {
    const router = useRouter();
    const { t, locale } = useTranslation();
    const dateLocale = LOCALE_TO_BCP47[locale];
    const [userName, setUserName] = useState("");
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const userId = localStorage.getItem("userId");
        const name = localStorage.getItem("userName") ?? "";
        if (!userId) { router.push("/login?redirect=/dashboard"); return; }
        setUserName(name);

        fetch("/api/reservations", { headers: { "x-user-id": userId } })
            .then((r) => r.json())
            .then((data) => {
                if (!data.success) throw new Error(data.error);
                setReservations(data.data);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [router]);

    const activeCount = reservations.filter((r) => ACTIVE_STATUSES.includes(r.status)).length;
    const canReserve = activeCount < MAX_ACTIVE;

    if (loading) {
        return (
            <div className="dash-loading">
                <span>{t.common.loading}</span>
            </div>
        );
    }

    return (
        <div className="dash-wrapper">

            {/* ── Header ── */}
            <div className="dash-header">
                <div className="dash-header__left">
                    <h1 className="dash-title">{t.dashboard.title}</h1>
                    <p className="dash-subtitle">{t.nav.greeting}, {userName}</p>
                </div>
                <div className="dash-header__right">
                    <div className="dash-slots">
                        <div className="dash-slots__label">{t.dashboard.upcoming}</div>
                        <div className="dash-slots__bar">
                            {Array.from({ length: MAX_ACTIVE }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`dash-slots__dot${i < activeCount ? " dash-slots__dot--on" : ""}`}
                                />
                            ))}
                        </div>
                        <div className="dash-slots__count">{activeCount} / {MAX_ACTIVE}</div>
                    </div>
                    <Link
                        href="/reservation"
                        className={`dash-new-btn${!canReserve ? " dash-new-btn--disabled" : ""}`}
                        onClick={(e) => { if (!canReserve) e.preventDefault(); }}
                    >
                        + {t.dashboard.cta}
                    </Link>
                </div>
            </div>

            <div className="dash-divider" />

            {/* ── Error ── */}
            {error && <div className="rf-error">⚠ {error}</div>}

            {/* ── Empty state ── */}
            {!error && reservations.length === 0 && (
                <div className="dash-empty">
                    <p className="dash-empty__text">{t.dashboard.empty}</p>
                    <Link href="/reservation" className="dash-new-btn">
                        {t.dashboard.cta}
                    </Link>
                </div>
            )}

            {/* ── Reservation cards ── */}
            <div className="dash-grid">
                {reservations.map((r) => {
                    const date = new Date(r.date);
                    const appUrl = typeof window !== "undefined" ? window.location.origin : "";
                    const checkinUrl = `${appUrl}/checkin/${r.qrToken}`;
                    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkinUrl)}`;
                    const isActive = ACTIVE_STATUSES.includes(r.status);

                    return (
                        <div key={r.id} className={`dash-card${!isActive ? " dash-card--inactive" : ""}`}>

                            {/* Status badge */}
                            <div className={`dash-badge ${STATUS_CLASS[r.status] ?? ""}`}>
                                {(t.dashboard.status as Record<string, string>)[r.status] ?? r.status}
                            </div>

                            <div className="dash-card__body">

                                {/* Left: details */}
                                <div className="dash-card__info">
                                    <div className="dash-card__date">
                                        {date.toLocaleDateString(dateLocale, {
                                            weekday: "long",
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric",
                                        })}
                                    </div>
                                    <div className="dash-card__time">
                                        {date.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                                    </div>

                                    <div className="dash-card__row">
                                        <span className="dash-card__label">{t.reservation.name}</span>
                                        <span className="dash-card__val">{r.guestName}</span>
                                    </div>
                                    <div className="dash-card__row">
                                        <span className="dash-card__label">{t.reservation.phone}</span>
                                        <span className="dash-card__val">{r.guestPhone}</span>
                                    </div>
                                    <div className="dash-card__row">
                                        <span className="dash-card__label">{t.reservation.guests}</span>
                                        <span className="dash-card__val">{r.guests}</span>
                                    </div>
                                    {r.sectionPreference && (
                                        <div className="dash-card__row">
                                            <span className="dash-card__label">{t.dashboard.section}</span>
                                            <span className="dash-card__val">{r.sectionPreference}</span>
                                        </div>
                                    )}
                                    {r.table && (
                                        <div className="dash-card__row">
                                            <span className="dash-card__label">{t.dashboard.section}</span>
                                            <span className="dash-card__val">
                                                #{r.table.number} — {r.table.section.name}
                                            </span>
                                        </div>
                                    )}
                                    {r.occasion && (
                                        <div className="dash-card__row">
                                            <span className="dash-card__label">{t.reservation.occasion}</span>
                                            <span className="dash-card__val">{r.occasion}</span>
                                        </div>
                                    )}
                                    {r.notes && (
                                        <div className="dash-card__notes">
                                            <span className="dash-card__label">{t.reservation.notes}</span>
                                            <p className="dash-card__notes-text">{r.notes}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Right: QR — solo si está confirmada */}
                                <div className="dash-card__qr">
                                    {r.status === "CONFIRMED" ? (
                                        <>
                                            <img
                                                src={qrImgUrl}
                                                alt="QR Check-in"
                                                className="dash-card__qr-img"
                                            />
                                            <p className="dash-card__qr-label">{t.dashboard.qrBtn}</p>
                                        </>
                                    ) : (
                                        <p className="dash-card__qr-label" style={{ opacity: 0.4, fontSize: "0.7rem", textAlign: "center" }}>
                                            {t.dashboard.qrBtn}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
