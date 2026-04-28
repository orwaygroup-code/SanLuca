"use client";

// ─────────────────────────────────────────────
//  components/menu/DishCard.tsx
//  Card para platillos individuales
// ─────────────────────────────────────────────

import Image from "next/image";
import { useState } from "react";
import { fonts, colors } from "@/config/theme";
import { useTranslation } from "@/lib/i18n";

type DishCardProps = {
    name: string;
    description?: string | null;
    price: number;
    weight?: number | null;
    imageUrl?: string | null;
    allergens?: string | null;
};

export default function DishCard({
    name,
    description,
    price,
    weight,
    imageUrl,
    allergens,
}: DishCardProps) {
    const { price: fmtPrice } = useTranslation();
    const [hovered, setHovered] = useState(false);

    return (
        <article
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: "#fff",
                borderRadius: "3px",
                overflow: "hidden",
                border: `1px solid ${hovered ? "rgba(186,132,60,0.4)" : "rgba(28,38,40,0.08)"}`,
                transition: "border-color 0.3s ease, box-shadow 0.3s ease",
                boxShadow: hovered
                    ? "0 8px 32px rgba(0,0,0,0.08)"
                    : "0 1px 4px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Image */}
            {imageUrl ? (
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        height: "200px",
                        overflow: "hidden",
                        flexShrink: 0,
                    }}
                >
                    <Image
                        src={imageUrl}
                        alt={name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        style={{
                            objectFit: "cover",
                            transform: hovered ? "scale(1.05)" : "scale(1)",
                            transition: "transform 0.5s ease",
                        }}
                    />
                </div>
            ) : (
                <div
                    style={{
                        width: "100%",
                        height: "160px",
                        background: `linear-gradient(135deg, #f5f0e8 0%, #ede5d4 100%)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    <span
                        style={{
                            fontSize: "2rem",
                            opacity: 0.25,
                        }}
                    >
                        ✦
                    </span>
                </div>
            )}

            {/* Info */}
            <div
                style={{
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    flex: 1,
                }}
            >
                <h3
                    style={{
                        fontFamily: fonts.primary,
                        fontSize: "1.05rem",
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                        color: "rgba(28,38,40,0.95)",
                        margin: 0,
                    }}
                >
                    {name}
                </h3>

                {description && (
                    <p
                        style={{
                            fontFamily: fonts.primary,
                            fontSize: "0.82rem",
                            color: "rgba(28,38,40,0.5)",
                            margin: 0,
                            lineHeight: 1.65,
                            flex: 1,
                        }}
                    >
                        {description}
                    </p>
                )}

                {allergens && (
                    <p
                        style={{
                            fontFamily: fonts.primary,
                            fontSize: "0.7rem",
                            color: "rgba(28,38,40,0.35)",
                            margin: 0,
                            fontStyle: "italic",
                        }}
                    >
                        {allergens}
                    </p>
                )}

                {/* Footer: price + weight */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginTop: "0.5rem",
                        paddingTop: "0.75rem",
                        borderTop: "1px solid rgba(28,38,40,0.07)",
                    }}
                >
                    <span
                        style={{
                            fontFamily: fonts.primary,
                            fontSize: "1.15rem",
                            fontWeight: 700,
                            color: colors.peru,
                        }}
                    >
                        {fmtPrice(price)}
                    </span>

                    {weight && (
                        <span
                            style={{
                                fontFamily: fonts.primary,
                                fontSize: "0.72rem",
                                letterSpacing: "0.15em",
                                textTransform: "uppercase",
                                color: "rgba(28,38,40,0.35)",
                            }}
                        >
                            {weight}g
                        </span>
                    )}
                </div>
            </div>
        </article>
    );
}