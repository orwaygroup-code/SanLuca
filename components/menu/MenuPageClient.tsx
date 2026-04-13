"use client";

// ─────────────────────────────────────────────
//  components/menu/MenuPageClient.tsx
//  Single page — switch COMIDA ↔ BRUNCH
//  SAN LUCA cambia color + switch con pill animado
// ─────────────────────────────────────────────

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { fonts, colors } from "@/config/theme";
import { BRUNCH_GROUPS, COMIDA_GROUPS } from "@/config/Menustructure";

type InsigniaItem = {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    imageUrl?: string | null;
    category?: string | null;
};

type DbCategory = {
    id: string;
    name: string;
    imageUrl?: string | null;
};

type MenuPageClientProps = {
    comidaDishes: InsigniaItem[];
    brunchDishes: InsigniaItem[];
    dbCategories: DbCategory[];
};

const THEME = {
    comida: {
        bg: "#1a2628",
        bgCard: "#253032",
        bgCardActive: "#2d3d40",
        text: "#ffffff",
        textMuted: "rgba(255,255,255,0.4)",
        textDim: "rgba(255,255,255,0.25)",
        accent: "#c9964a",
        accentMuted: "rgba(201,150,74,0.18)",
        border: "rgba(255,255,255,0.07)",
        borderAccent: "rgba(201,150,74,0.3)",
        pillBar: "rgba(255,255,255,0.08)",
        pillBarBorder: "rgba(255,255,255,0.14)",
        tabActive: "#c9964a",
        footerText: "#ffffff",
        insigniaBg: "#1a2628",
        insigniaTitle: "#ffffff",
        insigniaTitleAccent: "#c9964a",
        insigniaCard: "#253032",
        insigniaCardActive: "#2d3d40",
        insigniaNumber: "rgba(201,150,74,0.2)",
        insigniaNumberActive: "rgba(201,150,74,0.3)",
        btnBorder: "rgba(255,255,255,0.5)",
        btnText: "#ffffff",
    },
    brunch: {
        bg: "#f0ebe0",
        bgCard: "#e8e1d4",
        bgCardActive: "#ddd5c6",
        text: "#1e3a52",
        textMuted: "rgba(30,58,82,0.5)",
        textDim: "rgba(30,58,82,0.3)",
        accent: "#3d6b8c",
        accentMuted: "rgba(61,107,140,0.15)",
        border: "rgba(30,58,82,0.1)",
        borderAccent: "rgba(61,107,140,0.35)",
        pillBar: "rgba(61,107,140,0.08)",
        pillBarBorder: "rgba(61,107,140,0.2)",
        tabActive: "#3d6b8c",
        footerText: "#1e3a52",
        insigniaBg: "#f0ebe0",
        insigniaTitle: "#1e3a52",
        insigniaTitleAccent: "#3d6b8c",
        insigniaCard: "#4a7a9b",
        insigniaCardActive: "#3d6b8c",
        insigniaNumber: "rgba(255,255,255,0.18)",
        insigniaNumberActive: "rgba(255,255,255,0.28)",
        btnBorder: "rgba(30,58,82,0.4)",
        btnText: "#1e3a52",
    },
} as const;

type ThemeMode = keyof typeof THEME;

export default function MenuPageClient({ comidaDishes, brunchDishes, dbCategories }: MenuPageClientProps) {
    const searchParams = useSearchParams();
    const initialMode = searchParams.get("mode") === "brunch" ? "brunch" : "comida";
    const [mode, setMode] = useState<ThemeMode>(initialMode);
    const [activeTab, setActiveTab] = useState(0);
    const [hoveredCard, setHoveredCard] = useState<number | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const m = searchParams.get("mode");
        if (m === "brunch" || m === "comida") setMode(m);
    }, [searchParams]);

    // Notifica al Navbar el tema actual para que ajuste sus colores
    useEffect(() => {
        document.body.dataset.navTheme = mode;
        return () => { delete document.body.dataset.navTheme; };
    }, [mode]);

    const t = THEME[mode];
    const groups = mode === "comida"
        ? COMIDA_GROUPS.filter((g) => g.categories.length > 0)
        : BRUNCH_GROUPS;
    const currentGroup = groups[activeTab] ?? groups[0];

    const handleSwitch = (newMode: ThemeMode) => {
        setMode(newMode);
        setActiveTab(0);
    };

    const categoriesWithImages = (currentGroup?.categories ?? []).map((cat) => {
        const dbMatch = dbCategories.find(
            (d) => d.id === cat.slug || d.name.toLowerCase() === cat.name.toLowerCase()
        );
        return { ...cat, imageUrl: dbMatch?.imageUrl ?? cat.imageUrl ?? null };
    });

    return (
        <div>
            {/* ══════════════════════════════════
                HERO
            ══════════════════════════════════ */}
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
                    background: mode === "comida" ? "#111a1c" : "#e8e3d8",
                    transition: "background 0.6s ease",
                }}
            >
                {/* Bg image */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: `url(/images/${mode === "comida" ? "hero-menu.jpg" : "menu/hero/brunchHero.jpg"})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        opacity: mode === "comida" ? 0.5 : 0.35,
                        transition: "opacity 0.6s ease",
                    }}
                />

                {/* Brunch corner triangle */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: "120px",
                        height: "120px",
                        background: "#3d6b8c",
                        clipPath: "polygon(100% 0, 0 0, 100% 100%)",
                        zIndex: 1,
                        opacity: mode === "brunch" ? 1 : 0,
                        transition: "opacity 0.5s ease",
                    }}
                />

                {/* Overlay */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: mode === "comida"
                            ? "linear-gradient(to bottom, rgba(17,26,28,0.2) 0%, rgba(17,26,28,0.5) 60%, rgba(17,26,28,0.92) 100%)"
                            : "linear-gradient(to bottom, rgba(240,235,224,0.15) 0%, rgba(240,235,224,0.45) 60%, rgba(240,235,224,0.95) 100%)",
                        transition: "background 0.6s ease",
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
                    {/* ── SAN LUCA: blanco en comida, azul en brunch ── */}
                    <div
                        style={{
                            fontFamily: fonts.primary,
                            fontSize: "clamp(5rem, 14vw, 10rem)",
                            fontWeight: 800,
                            lineHeight: 0.82,

                            textTransform: "uppercase",
                            color: mode === "comida" ? (colors.cream ?? "#ffffff") : "#1e3a52",
                            transition: "color 0.5s ease",
                        }}
                    >
                        SAN
                        <br />
                        LUCA
                    </div>

                    {/* Cursive */}
                    <p
                        style={{
                            fontFamily: fonts.script ?? "'Dancing Script', cursive",
                            fontSize: "clamp(1.6rem, 4vw, 3rem)",
                            fontWeight: 400,
                            color: mode === "comida" ? "#ffffff" : "#1e3a52",
                            margin: "0 0 2.5rem",
                            transition: "color 0.5s ease",
                        }}
                    >
                        {mode === "comida" ? "Ristorante" : "Brunch"}
                    </p>

                    {/* Créditos */}
                    <div style={{ marginBottom: "3rem" }}>
                        <p
                            style={{
                                fontFamily: fonts.primary,
                                fontSize: "0.72rem",
                                textTransform: "uppercase",
                                color: mode === "comida" ? colors.peru : "#3d6b8c",
                                margin: "0 0 0.35rem",
                                transition: "color 0.5s ease",
                            }}
                        >
                            Un menú diseñado por:
                        </p>
                        <p
                            style={{
                                fontFamily: fonts.primary,
                                fontSize: "0.92rem",
                                textTransform: "uppercase",
                                color: mode === "comida" ? "rgba(255,255,255,0.8)" : "rgba(30,58,82,0.75)",
                                margin: 0,
                                transition: "color 0.5s ease",
                            }}
                        >
                            Ricardo Camacho y Franccesca Mette
                        </p>
                    </div>

                    {/* ══════════════════════════════════
                        SWITCH — pill deslizante animado
                        El fondo blanco/azul se traslada
                        con cubic-bezier con rebote suave
                    ══════════════════════════════════ */}
                    <div
                        style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            background: mode === "comida"
                                ? "rgba(255,255,255,0.1)"
                                : "rgba(30,58,82,0.08)",
                            borderRadius: "999px",
                            padding: "5px",
                            border: mode === "comida"
                                ? "1px solid rgba(255,255,255,0.2)"
                                : "1px solid rgba(30,58,82,0.2)",
                            transition: "background 0.4s ease, border-color 0.4s ease",
                        }}
                    >
                        {/* Pill deslizante — la "pastilla" de fondo */}
                        <div
                            style={{
                                position: "absolute",
                                top: "5px",
                                bottom: "5px",
                                left: mode === "comida" ? "5px" : "calc(50%)",
                                width: "calc(50% - 5px)",
                                borderRadius: "999px",
                                background: mode === "comida" ? "#ffffff" : "#3d6b8c",
                                boxShadow: "0 2px 14px rgba(0,0,0,0.2)",
                                // rebote suave al cambiar
                                transition: "left 0.4s cubic-bezier(0.34,1.56,0.64,1), background 0.4s ease",
                                pointerEvents: "none",
                                zIndex: 0,
                            }}
                        />

                        {/* Botón COMIDA */}
                        <button
                            onClick={() => handleSwitch("comida")}
                            style={{
                                position: "relative",
                                zIndex: 1,
                                fontFamily: fonts.primary,
                                fontSize: "0.75rem",
                                textTransform: "uppercase",
                                fontWeight: 600,
                                padding: "0.9rem 2.75rem",
                                borderRadius: "999px",
                                border: "none",
                                cursor: "pointer",
                                background: "transparent",
                                minWidth: "130px",
                                // negro sobre blanco cuando activo, apagado si no
                                color: mode === "comida"
                                    ? "#111a1c"
                                    : mode === "brunch"
                                        ? "rgba(30,58,82,0.55)"
                                        : "rgba(255,255,255,0.7)",
                                transition: "color 0.35s ease",
                            }}
                        >
                            Comida
                        </button>

                        {/* Botón BRUNCH */}
                        <button
                            onClick={() => handleSwitch("brunch")}
                            style={{
                                position: "relative",
                                zIndex: 1,
                                fontFamily: fonts.primary,
                                fontSize: "0.75rem",
                                textTransform: "uppercase",
                                fontWeight: 600,
                                padding: "0.9rem 2.75rem",
                                borderRadius: "999px",
                                border: "none",
                                cursor: "pointer",
                                background: "transparent",
                                minWidth: "130px",
                                // blanco sobre azul cuando activo
                                color: mode === "brunch"
                                    ? "#ffffff"
                                    : mode === "comida"
                                        ? "rgba(255,255,255,0.6)"
                                        : "rgba(30,58,82,0.55)",
                                transition: "color 0.35s ease",
                            }}
                        >
                            Brunch
                        </button>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════
                CONTENIDO
            ══════════════════════════════════ */}
            <div ref={contentRef} style={{ background: t.bg, transition: "background 0.5s ease" }}>

                <PlatosInsignia
                    dishes={mode === "comida" ? comidaDishes : brunchDishes}
                    t={t}
                    mode={mode}
                    hoveredCard={hoveredCard}
                    setHoveredCard={setHoveredCard}
                />

                {/* TABS + GRID */}
                <section style={{ background: t.bg, paddingBottom: "5rem" }}>
                    <div style={{ display: "flex", justifyContent: "center", padding: "0 1.5rem 4rem" }}>
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                justifyContent: "center",
                                gap: "4px",
                                background: t.pillBar,
                                borderRadius: "999px",
                                padding: "5px",
                                border: `1px solid ${t.pillBarBorder}`,
                            }}
                        >
                            {groups.map((group, i) => {
                                const isActive = activeTab === i;
                                return (
                                    <button
                                        key={group.slug}
                                        onClick={() => setActiveTab(i)}
                                        style={{
                                            fontFamily: fonts.primary,
                                            fontSize: "0.72rem",
                                            textTransform: "uppercase",
                                            fontWeight: 600,
                                            padding: "0.8rem 1.75rem",
                                            borderRadius: "999px",
                                            border: "none",
                                            cursor: "pointer",
                                            transition: "all 0.25s ease",
                                            background: isActive ? t.tabActive : "transparent",
                                            color: isActive ? "#ffffff" : t.textMuted,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {group.groupName.toUpperCase()}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ maxWidth: "1320px", margin: "0 auto", padding: "0 clamp(1rem, 3vw, 3rem)" }}>
                        <style>{`
                            @media (max-width: 640px) {
                                .category-grid {
                                    grid-template-columns: repeat(2, 1fr) !important;
                                    grid-auto-rows: 160px !important;
                                }
                            }
                            @media (min-width: 641px) and (max-width: 1024px) {
                                .category-grid {
                                    grid-template-columns: repeat(2, 1fr) !important;
                                }
                            }
                        `}</style>
                        <div
                            className="category-grid"
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, 1fr)",
                                gridAutoRows: "220px",
                                gap: "6px",
                            }}
                        >
                            {categoriesWithImages.map((cat) => (
                                <CategoryCard
                                    key={cat.slug}
                                    name={cat.name}
                                    imageUrl={cat.imageUrl}
                                    href={`/menu/${mode}/${encodeURIComponent(cat.name)}`}
                                    t={t}
                                />
                            ))}
                        </div>

                        <div
                            style={{
                                textAlign: "center",
                                marginTop: "4rem",
                                paddingTop: "3rem",
                                borderTop: `1px solid ${t.border}`,
                            }}
                        >
                            <p
                                style={{
                                    fontFamily: fonts.primary,
                                    fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
                                    fontWeight: 800,
                                    textTransform: "uppercase",
                                    color: t.footerText,

                                    transition: "color 0.5s ease",
                                }}
                            >
                                SAN LUCA
                            </p>
                            <p
                                style={{
                                    fontFamily: fonts.script ?? "'Dancing Script', cursive",
                                    fontSize: "clamp(1rem, 2vw, 1.4rem)",
                                    color: t.textMuted,
                                    margin: 0,
                                    transition: "color 0.5s ease",
                                }}
                            >
                                {mode === "comida" ? "Ristorante" : "Brunch"}
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════
//  PLATOS INSIGNIA
// ══════════════════════════════════════════════
function PlatosInsignia({
    dishes, t, mode, hoveredCard, setHoveredCard,
}: {
    dishes: InsigniaItem[];
    t: (typeof THEME)[ThemeMode];
    mode: ThemeMode;
    hoveredCard: number | null;
    setHoveredCard: (i: number | null) => void;
}) {
    const featured = dishes;

    return (
        <section
            style={{
                background: t.insigniaBg,
                padding: "clamp(4rem, 8vw, 7rem) clamp(1.5rem, 4vw, 4rem)",
                transition: "background 0.5s ease",
            }}
        >
            <style>{`
                @media (max-width: 640px) {
                    .podium-grid {
                        grid-template-columns: 1fr !important;
                        align-items: stretch !important;
                    }
                    .podium-card {
                        min-height: 200px !important;
                        box-shadow: none !important;
                        padding: 2rem 1.5rem !important;
                    }
                    .podium-card[data-rank="1"] { order: 1; }
                    .podium-card[data-rank="2"] { order: 2; }
                    .podium-card[data-rank="3"] { order: 3; }
                    .insignia-header {
                        flex-direction: column !important;
                        gap: 1.5rem !important;
                    }
                }
            `}</style>
            <div
                className="insignia-header"
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    maxWidth: "1320px",
                    margin: "0 auto",
                    marginBottom: "clamp(3rem, 6vw, 5rem)",
                }}
            >
                <div>
                    <h2 style={{ fontFamily: fonts.primary, fontSize: "clamp(3rem, 7vw, 6.5rem)", fontWeight: 700, color: t.insigniaTitle, margin: 0, lineHeight: 0.9, textTransform: "uppercase", transition: "color 0.5s ease" }}>
                        PLATOS
                    </h2>
                    <h2 style={{ fontFamily: fonts.primary, fontSize: "clamp(3rem, 7vw, 6.5rem)", fontWeight: 700, color: t.insigniaTitleAccent, margin: 0, lineHeight: 0.9, textTransform: "uppercase", transition: "color 0.5s ease" }}>
                        INSIGNIA
                    </h2>
                </div>

                <Link href="/reservation" style={{ textDecoration: "none", flexShrink: 0, marginTop: "0.5rem" }}>
                    <button
                        style={{
                            fontFamily: fonts.primary, fontSize: "0.72rem", textTransform: "uppercase",
                            fontWeight: 600, padding: "1rem 2rem", background: "transparent",
                            color: t.btnText, border: `1px solid ${t.btnBorder}`, cursor: "pointer",
                            transition: "all 0.25s ease",
                        }}
                    >
                        RESERVA AHORA
                    </button>
                </Link>
            </div>

            {/* Podium: el #1 (índice 0) va al centro, #2 izquierda, #3 derecha */}
            {(() => {
                const podium = featured.length === 3
                    ? [featured[1], featured[0], featured[2]]
                    : featured;
                const originalIndex = featured.length === 3
                    ? [1, 0, 2]
                    : featured.map((_, i) => i);

                return (
                    <div className="podium-grid" style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "1px",
                        maxWidth: "1320px",
                        margin: "0 auto",
                        alignItems: "end",
                    }}>
                        {podium.map((dish, displayIdx) => {
                            const origIdx = originalIndex[displayIdx];
                            const isCenter = displayIdx === 1;
                            const isActive = hoveredCard === origIdx || (hoveredCard === null && isCenter);
                            const numStr = String(origIdx + 1).padStart(2, "0");

                            return (
                                <article
                                    key={dish.id}
                                    className="podium-card"
                                    data-rank={origIdx + 1}
                                    onMouseEnter={() => setHoveredCard(origIdx)}
                                    onMouseLeave={() => setHoveredCard(null)}
                                    style={{
                                        position: "relative",
                                        padding: isCenter ? "3rem 2rem" : "2.5rem 2rem",
                                        background: isActive ? t.insigniaCardActive : t.insigniaCard,
                                        border: isActive ? `1px solid ${t.borderAccent}` : `1px solid ${t.border}`,
                                        transition: "all 0.3s ease",
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "space-between",
                                        minHeight: isCenter ? "380px" : "280px",
                                        boxShadow: isCenter ? `0 -6px 32px rgba(0,0,0,0.35)` : "none",
                                    }}
                                >
                                    <div style={{ position: "absolute", top: "1.25rem", right: "1.5rem", fontFamily: fonts.primary, fontSize: "clamp(4rem, 8vw, 7rem)", fontWeight: 700, color: isActive ? t.insigniaNumberActive : t.insigniaNumber, lineHeight: 1, transition: "color 0.3s ease", userSelect: "none" }}>
                                        {numStr}
                                    </div>
                                    <div>
                                        <p style={{ fontFamily: fonts.primary, fontSize: "0.65rem", textTransform: "uppercase", color: isActive ? (mode === "comida" ? colors.peru : "#ffffff") : "rgba(255,255,255,0.5)", margin: "0 0 0.75rem", transition: "color 0.3s ease" }}>
                                            {dish.category ?? (mode === "comida" ? "Clásica" : "Brunch")}
                                        </p>
                                        <h3 style={{ fontFamily: fonts.primary, fontSize: isCenter ? "clamp(1.5rem, 2.8vw, 2.1rem)" : "clamp(1.3rem, 2.5vw, 1.9rem)", fontWeight: 700, textTransform: "uppercase", color: "#ffffff", margin: "0 0 1rem", lineHeight: 1.1, maxWidth: "20ch" }}>
                                            {dish.name}
                                        </h3>
                                        {dish.description && (
                                            <p style={{ fontFamily: fonts.primary, fontSize: "0.78rem", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.6, maxWidth: "30ch" }}>
                                                {dish.description}
                                            </p>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2rem", paddingTop: "1.25rem", borderTop: `1px solid ${isActive ? t.borderAccent : t.border}` }}>
                                        <span style={{ fontFamily: fonts.primary, fontSize: isCenter ? "1.5rem" : "1.2rem", fontWeight: 600, color: isActive ? (mode === "comida" ? colors.peru : "#ffffff") : "rgba(255,255,255,0.6)", transition: "color 0.3s ease" }}>
                                            ${dish.price.toFixed(0)}
                                        </span>
                                        <div style={{ width: "40px", height: "1px", background: isActive ? t.accent : "rgba(255,255,255,0.2)", transition: "background 0.3s ease" }} />
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                );
            })()}
        </section>
    );
}

// ══════════════════════════════════════════════
//  CATEGORY CARD
// ══════════════════════════════════════════════
function CategoryCard({ name, imageUrl, href, t }: { name: string; imageUrl?: string | null; href: string; t: (typeof THEME)[ThemeMode] }) {
    const [hovered, setHovered] = useState(false);
    return (
        <Link href={href} style={{ textDecoration: "none", display: "block", height: "100%" }}>
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: t.bgCard, cursor: "pointer", transition: "background 0.5s ease" }}
            >
                {imageUrl ? (
                    <Image src={imageUrl} alt={name} fill sizes="(max-width: 768px) 50vw, 25vw"
                        style={{ objectFit: "cover", transform: hovered ? "scale(1.07)" : "scale(1)", transition: "transform 0.55s ease", filter: hovered ? "brightness(0.6)" : "brightness(0.45)" }}
                    />
                ) : (
                    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${t.bgCard} 0%, ${t.bg} 100%)` }} />
                )}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.05) 60%)" }} />
                <div style={{ position: "absolute", bottom: "1.25rem", left: "1.25rem", right: "1.25rem" }}>
                    <p style={{ fontFamily: fonts.primary, fontSize: "clamp(0.75rem, 1.3vw, 0.95rem)", fontWeight: 700, textTransform: "uppercase", color: "#ffffff", margin: 0, textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
                        {name.toUpperCase()}
                    </p>
                </div>
            </div>
        </Link>
    );
}   