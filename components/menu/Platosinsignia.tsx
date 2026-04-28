"use client";

// ─────────────────────────────────────────────
//  components/menu/PlatosInsignia.tsx
//  Página 2 PDF — PLATOS INSIGNIA section
//  3 cards con número, categoría, nombre, precio
// ─────────────────────────────────────────────

import Link from "next/link";
import { useState } from "react";
import { fonts, colors } from "@/config/theme";
import Image from "next/image";
import { useTranslation } from "@/lib/i18n";

type InsigniaItem = {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    imageUrl?: string | null;
    category?: string | null;
};

type PlatosInsigniaProps = {
    dishes: InsigniaItem[];
};

export default function PlatosInsignia({ dishes }: PlatosInsigniaProps) {
    const { price: fmtPrice } = useTranslation();
    const [activeCard, setActiveCard] = useState(1); // 0-indexed, card del medio activo por default

    const featured = dishes.slice(0, 3);

    return (
        <section
            style={{
                background: "#1a2628",
                padding: "clamp(4rem, 8vw, 7rem) clamp(1.5rem, 4vw, 4rem)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* ── TOP ROW: título + botón ── */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    maxWidth: "1320px",
                    margin: "0 auto",
                    marginBottom: "clamp(3rem, 6vw, 5rem)",
                }}
            >
                {/* PLATOS INSIGNIA */}
                <div>
                    <h2
                        style={{
                            fontFamily: fonts.primary,
                            fontSize: "clamp(3rem, 7vw, 6.5rem)",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            color: "#ffffff",
                            margin: 0,
                            lineHeight: 0.9,
                            textTransform: "uppercase",
                        }}
                    >
                        PLATOS
                    </h2>
                    <h2
                        style={{
                            fontFamily: fonts.primary,
                            fontSize: "clamp(3rem, 7vw, 6.5rem)",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            color: colors.peru,
                            margin: 0,
                            lineHeight: 0.9,
                            textTransform: "uppercase",
                        }}
                    >
                        INSIGNIA
                    </h2>
                </div>

                {/* VER EN EL MENU */}
                <Link href="/menu/comida" style={{ textDecoration: "none", flexShrink: 0, marginTop: "0.5rem" }}>
                    <button
                        style={{
                            fontFamily: fonts.primary,
                            fontSize: "0.72rem",
                            letterSpacing: "0.3em",
                            textTransform: "uppercase",
                            fontWeight: 600,
                            padding: "1rem 2rem",
                            background: "transparent",
                            color: "#ffffff",
                            border: "1px solid rgba(255,255,255,0.5)",
                            cursor: "pointer",
                            transition: "all 0.25s ease",
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        }}
                    >
                        VER EN EL MENU
                    </button>
                </Link>
            </div>

            {/* ── 3 CARDS ── */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "1px",
                    maxWidth: "1320px",
                    margin: "0 auto",
                }}
            >
                {featured.map((dish, i) => {
                    const isActive = activeCard === i;
                    const numStr = String(i + 1).padStart(2, "0");

                    return (
                        <article
                            key={dish.id}
                            onMouseEnter={() => setActiveCard(i)}
                            style={{
                                position: "relative",
                                padding: "2.5rem 2rem",
                                background: isActive ? "#253032" : "#1e2d30",
                                border: isActive
                                    ? `1px solid rgba(201,150,74,0.3)`
                                    : "1px solid rgba(255,255,255,0.05)",
                                transition: "all 0.3s ease",
                                cursor: "pointer",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                minHeight: "280px",
                            }}
                        >
                            {/* Number — large watermark */}
                            <div
                                style={{
                                    position: "absolute",
                                    top: "1.25rem",
                                    right: "1.5rem",
                                    fontFamily: fonts.primary,
                                    fontSize: "clamp(4rem, 8vw, 7rem)",
                                    fontWeight: 700,
                                    color: isActive
                                        ? "rgba(201,150,74,0.25)"
                                        : "rgba(255,255,255,0.06)",
                                    lineHeight: 1,
                                    letterSpacing: "-0.04em",
                                    transition: "color 0.3s ease",
                                    userSelect: "none",
                                }}
                            >
                                {numStr}
                            </div>

                            {/* Top: category label */}
                            <div>
                                <p
                                    style={{
                                        fontFamily: fonts.primary,
                                        fontSize: "0.65rem",
                                        letterSpacing: "0.3em",
                                        textTransform: "uppercase",
                                        color: isActive ? colors.peru : "rgba(255,255,255,0.4)",
                                        margin: "0 0 0.75rem",
                                        transition: "color 0.3s ease",
                                    }}
                                >
                                    {dish.category ?? "Clásica"}
                                </p>

                                <h3
                                    style={{
                                        fontFamily: fonts.primary,
                                        fontSize: "clamp(1.3rem, 2.5vw, 1.9rem)",
                                        fontWeight: 700,
                                        letterSpacing: "0.06em",
                                        textTransform: "uppercase",
                                        color: "#ffffff",
                                        margin: "0 0 1rem",
                                        lineHeight: 1.1,
                                        maxWidth: "20ch",
                                    }}
                                >
                                    {dish.name}
                                </h3>

                                {dish.description && (
                                    <p
                                        style={{
                                            fontFamily: fonts.primary,
                                            fontSize: "0.78rem",
                                            letterSpacing: "0.08em",
                                            textTransform: "uppercase",
                                            color: "rgba(255,255,255,0.45)",
                                            margin: 0,
                                            lineHeight: 1.6,
                                            maxWidth: "30ch",
                                        }}
                                    >
                                        {dish.description}
                                    </p>
                                )}
                            </div>

                            {/* Bottom: price + divider line */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    marginTop: "2rem",
                                    paddingTop: "1.25rem",
                                    borderTop: `1px solid ${isActive ? "rgba(201,150,74,0.2)" : "rgba(255,255,255,0.07)"}`,
                                }}
                            >
                                <span
                                    style={{
                                        fontFamily: fonts.primary,
                                        fontSize: "1.2rem",
                                        fontWeight: 600,
                                        color: isActive ? colors.peru : "rgba(255,255,255,0.7)",
                                        transition: "color 0.3s ease",
                                    }}
                                >
                                    {fmtPrice(dish.price)}
                                </span>

                                <div
                                    style={{
                                        width: "40px",
                                        height: "1px",
                                        background: isActive ? colors.peru : "rgba(255,255,255,0.2)",
                                        transition: "background 0.3s ease",
                                    }}
                                />
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}