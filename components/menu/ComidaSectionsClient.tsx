"use client";

// ─────────────────────────────────────────────
//  components/menu/ComidaSectionsClient.tsx
//  Página 2 bottom + Página 3 PDF
//  Tabs de sección + grid de categorías con imagen
// ─────────────────────────────────────────────

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { fonts, colors } from "@/config/theme";
import { COMIDA_GROUPS } from "@/config/Menustructure";

type DbCategory = {
    id: string;
    name: string;
    imageUrl?: string | null;
};

type ComidaSectionsClientProps = {
    dbCategories: DbCategory[];
};

const TAB_GROUPS = COMIDA_GROUPS.filter((g) => g.categories.length > 0);

export default function ComidaSectionsClient({
    dbCategories,
}: ComidaSectionsClientProps) {
    const [activeTab, setActiveTab] = useState(0);

    const currentGroup = TAB_GROUPS[activeTab];

    // Merge static structure with DB image data
    const categoriesWithImages = currentGroup.categories.map((cat) => {
        const dbMatch = dbCategories.find(
            (d) =>
                d.id === cat.slug ||
                d.name.toLowerCase() === cat.name.toLowerCase()
        );
        return {
            ...cat,
            imageUrl: dbMatch?.imageUrl ?? cat.imageUrl ?? null,
        };
    });

    return (
        <section
            style={{
                background: "#1a2628",
                paddingBottom: "5rem",
            }}
        >
            {/* ── FILTER TABS PILL BAR ── */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    paddingTop: "0",
                    paddingBottom: "4rem",
                    paddingLeft: "1.5rem",
                    paddingRight: "1.5rem",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        gap: "4px",
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "999px",
                        padding: "5px",
                        border: "1px solid rgba(255,255,255,0.08)",
                    }}
                >
                    {TAB_GROUPS.map((group, i) => {
                        const isActive = activeTab === i;
                        return (
                            <button
                                key={group.slug}
                                onClick={() => setActiveTab(i)}
                                style={{
                                    fontFamily: fonts.primary,
                                    fontSize: "0.72rem",
                                    letterSpacing: "0.28em",
                                    textTransform: "uppercase",
                                    fontWeight: 600,
                                    padding: "0.8rem 1.75rem",
                                    borderRadius: "999px",
                                    border: "none",
                                    cursor: "pointer",
                                    transition: "all 0.25s ease",
                                    background: isActive ? colors.peru : "transparent",
                                    color: isActive ? "#ffffff" : "rgba(255,255,255,0.5)",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {group.groupName.toUpperCase()}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── CATEGORY IMAGE GRID (Página 3 PDF) ── */}
            <div
                style={{
                    maxWidth: "1320px",
                    margin: "0 auto",
                    padding: "0 clamp(1rem, 3vw, 3rem)",
                }}
            >
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gridAutoRows: "220px",
                        gap: "6px",
                    }}
                >
                    {categoriesWithImages.map((cat, i) => (
                        <CategoryImageCard
                            key={cat.slug}
                            name={cat.name}
                            imageUrl={cat.imageUrl}
                            href={`/menu/comida/${cat.slug}`}
                            isLarge={i === 3 || i === 7} // Cada 4 cartas, la última fila ocupa más
                        />
                    ))}
                </div>

                {/* San Luca footer logo */}
                <div
                    style={{
                        textAlign: "center",
                        marginTop: "4rem",
                        paddingTop: "3rem",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <p
                        style={{
                            fontFamily: fonts.primary,
                            fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
                            fontWeight: 800,

                            textTransform: "uppercase",
                            color: "#ffffff",
                            margin: "0 0 0.15rem",
                        }}
                    >
                        SAN LUCA
                    </p>
                    <p
                        style={{
                            fontFamily: fonts.script,
                            fontSize: "clamp(1rem, 2vw, 1.4rem)",
                            color: "rgba(255,255,255,0.5)",
                            margin: 0,
                        }}
                    >
                        Ristorante
                    </p>
                </div>
            </div>
        </section>
    );
}

// ── Single category image card ──────────────
function CategoryImageCard({
    name,
    imageUrl,
    href,
    isLarge,
}: {
    name: string;
    imageUrl?: string | null;
    href: string;
    isLarge?: boolean;
}) {
    const [hovered, setHovered] = useState(false);

    return (
        <Link
            href={href}
            style={{ textDecoration: "none", display: "block" }}
        >
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "#253032",
                }}
            >
                {/* Image */}
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={name}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        style={{
                            objectFit: "cover",
                            transform: hovered ? "scale(1.07)" : "scale(1)",
                            transition: "transform 0.55s ease",
                            filter: hovered ? "brightness(0.65)" : "brightness(0.5)",
                        }}
                    />
                ) : (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background: `linear-gradient(135deg, #253032 0%, #1a2628 100%)`,
                        }}
                    />
                )}

                {/* Overlay */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background:
                            "linear-gradient(to top, rgba(17,26,28,0.85) 0%, rgba(17,26,28,0.1) 60%)",
                    }}
                />

                {/* Category name */}
                <div
                    style={{
                        position: "absolute",
                        bottom: "1.25rem",
                        left: "1.25rem",
                        right: "1.25rem",
                    }}
                >
                    <p
                        style={{
                            fontFamily: fonts.primary,
                            fontSize: "clamp(0.8rem, 1.4vw, 1rem)",
                            fontWeight: 700,
                            letterSpacing: "0.15em",
                            textTransform: "uppercase",
                            color: "#ffffff",
                            margin: 0,
                            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                        }}
                    >
                        {name.toUpperCase()}
                    </p>
                </div>
            </div>
        </Link>
    );
}