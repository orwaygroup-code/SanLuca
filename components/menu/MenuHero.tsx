"use client";

// ─────────────────────────────────────────────
//  components/menu/MenuHero.tsx
//  Página 1 PDF — SAN LUCA hero con COMIDA/BRUNCH
// ─────────────────────────────────────────────

import Link from "next/link";
import { useState } from "react";
import { fonts, colors } from "@/config/theme";
import { useTranslation } from "@/lib/i18n";

type MenuHeroProps = {
    backgroundImage?: string;
};

export default function MenuHero({
    backgroundImage = "/images/hero-menu.jpg",
}: MenuHeroProps) {
    const { t, locale } = useTranslation();
    const [hovered, setHovered] = useState<"comida" | "brunch" | null>(null);

    return (
        <section
            style={{
                position: "relative",
                width: "100%",
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                background: "#111a1c",
            }}
        >
            {/* Background */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url(${backgroundImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    opacity: 0.55,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background:
                        "linear-gradient(to bottom, rgba(17,26,28,0.25) 0%, rgba(17,26,28,0.5) 60%, rgba(17,26,28,0.9) 100%)",
                }}
            />

            {/* Content */}
            <div
                style={{
                    position: "relative",
                    zIndex: 2,
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "0 2rem",
                }}
            >
                {/* SAN LUCA */}
                <div
                    style={{
                        fontFamily: fonts.primary,
                        fontSize: "10rem",
                        color: colors.cream,
                        lineHeight: 0.82
                    }}
                >
                    SAN
                    <br />
                    LUCA
                </div>

                {/* Restaurante cursive */}
                <div
                    style={{
                        fontFamily: fonts.script,
                        fontSize: "clamp(1.2rem, 3vw, 2rem)",
                        color: colors.cream,

                        opacity: 0.7,
                        marginTop: 12,
                    }}
                >
                    Ristorante
                </div>

                {/* Créditos */}
                <div style={{ marginBottom: "3rem" }}>
                    <p
                        style={{
                            fontFamily: fonts.primary,
                            fontSize: "0.72rem",
                            letterSpacing: "0.3em",
                            textTransform: "uppercase",
                            color: colors.peru,
                            margin: "0 0 0.35rem",
                        }}
                    >
                        Un menú diseñado por:
                    </p>
                    <p
                        style={{
                            fontFamily: fonts.primary,
                            fontSize: "0.92rem",
                            letterSpacing: "0.18em",
                            textTransform: "uppercase",
                            color: "rgba(255,255,255,0.8)",
                            margin: 0,
                        }}
                    >
                        Ricardo Camacho y Franccesca Mette
                    </p>
                </div>

                {/* Pill buttons — COMIDA / BRUNCH */}
                <div
                    style={{
                        display: "flex",
                        background: "rgba(255,255,255,0.1)",
                        borderRadius: "999px",
                        padding: "5px",
                        border: "1px solid rgba(255,255,255,0.18)",
                        gap: 0,
                    }}
                >
                    <Link href="/menu/comida" style={{ textDecoration: "none" }}>
                        <button
                            onMouseEnter={() => setHovered("comida")}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                fontFamily: fonts.primary,
                                fontSize: "0.75rem",
                                letterSpacing: "0.3em",
                                textTransform: "uppercase",
                                fontWeight: 600,
                                padding: "0.9rem 2.75rem",
                                borderRadius: "999px",
                                border: "none",
                                cursor: "pointer",
                                transition: "all 0.25s ease",
                                background:
                                    hovered === "comida"
                                        ? "rgba(255,255,255,0.12)"
                                        : "transparent",
                                color: "#fff",
                            }}
                        >
                            {t.menu.sectionTitles.comida}
                        </button>
                    </Link>

                    <Link href="/menu/brunch" style={{ textDecoration: "none" }}>
                        <button
                            onMouseEnter={() => setHovered("brunch")}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                fontFamily: fonts.primary,
                                fontSize: "0.75rem",
                                letterSpacing: "0.3em",
                                textTransform: "uppercase",
                                fontWeight: 600,
                                padding: "0.9rem 2.75rem",
                                borderRadius: "999px",
                                border: "none",
                                cursor: "pointer",
                                transition: "all 0.25s ease",
                                background: "#ffffff",
                                color: "#111a1c",
                                boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                            }}
                        >
                            {t.menu.sectionTitles.brunch}
                        </button>
                    </Link>
                </div>

                {locale !== "es" && (
                    <div style={{
                        marginTop: 28,
                        padding: "8px 18px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "rgba(255,255,255,0.75)",
                        fontFamily: fonts.primary,
                        fontSize: "0.7rem",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                    }}>
                        {t.menu.pricesNote}
                    </div>
                )}
            </div>
        </section>
    );
}