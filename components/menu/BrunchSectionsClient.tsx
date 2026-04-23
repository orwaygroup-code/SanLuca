"use client";

// ─────────────────────────────────────────────
//  components/menu/BrunchSectionsClient.tsx
//  Tabs BRUNCH / BEBIDAS + grid de categorías
//  mismo sistema que ComidaSectionsClient
// ─────────────────────────────────────────────

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { fonts, colors } from "@/config/theme";
import { BRUNCH_GROUPS } from "@/config/Menustructure";

type DbCategory = {
    id: string;
    name: string;
    imageUrl?: string | null;
};

type BrunchSectionsClientProps = {
    dbCategories: DbCategory[];
};

export default function BrunchSectionsClient({
    dbCategories,
}: BrunchSectionsClientProps) {
    const [activeTab, setActiveTab] = useState(0);

    const currentGroup = BRUNCH_GROUPS[activeTab];

    const categoriesWithImages = currentGroup.categories.map((cat) => {
        const catName = cat.name.toLowerCase();
        const dbMatch = dbCategories.find(
            (d) =>
                d.id === cat.slug ||
                d.name.toLowerCase() === catName ||
                d.name.toLowerCase().startsWith(catName)
        );
        return {
            ...cat,
            imageUrl: dbMatch?.imageUrl ?? cat.imageUrl ?? null,
        };
    });

    return (
        <section style={{ background: "#1a2628", paddingBottom: "5rem" }}>

            {/* ── TABS PILL BAR: BRUNCH / BEBIDAS ── */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "0 1.5rem 4rem",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "999px",
                        padding: "5px",
                        border: "1px solid rgba(255,255,255,0.08)",
                        gap: 0,
                    }}
                >
                    {BRUNCH_GROUPS.map((group, i) => {
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
                                    padding: "0.8rem 2.25rem",
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

            {/* ── CATEGORY IMAGE GRID ── */}
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
                        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
                        gridAutoRows: "220px",
                        gap: "6px",
                    }}
                >
                    {categoriesWithImages.map((cat) => (
                        <BrunchCategoryCard
                            key={cat.slug}
                            name={cat.name}
                            description={cat.description}
                            imageUrl={cat.imageUrl}
                            href={`/menu/brunch/${cat.slug}`}
                        />
                    ))}
                </div>

                {/* San Luca footer */}
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
                        Brunch
                    </p>
                </div>
            </div>
        </section>
    );
}

// ── Single card ──────────────────────────────
function BrunchCategoryCard({
    name,
    description,
    imageUrl,
    href,
}: {
    name: string;
    description?: string;
    imageUrl?: string | null;
    href: string;
}) {
    const [hovered, setHovered] = useState(false);

    return (
        <Link href={href} style={{ textDecoration: "none", display: "block", height: "100%" }}>
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    background: "#253032",
                    cursor: "pointer",
                }}
            >
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
                            background: "linear-gradient(135deg, #253032 0%, #1a2628 100%)",
                        }}
                    />
                )}

                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        background:
                            "linear-gradient(to top, rgba(17,26,28,0.85) 0%, rgba(17,26,28,0.1) 60%)",
                    }}
                />

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
                        }}
                    >
                        {name.toUpperCase()}
                    </p>
                    {description && (
                        <p
                            style={{
                                fontFamily: fonts.primary,
                                fontSize: "0.7rem",
                                color: "rgba(255,255,255,0.45)",
                                margin: "4px 0 0",
                                opacity: hovered ? 1 : 0,
                                transform: hovered ? "translateY(0)" : "translateY(4px)",
                                transition: "all 0.3s ease",
                            }}
                        >
                            {description}
                        </p>
                    )}
                </div>
            </div>
        </Link>
    );
}