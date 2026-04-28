"use client";

import Image from "next/image";
import { useState } from "react";
import { fonts } from "@/config/theme";
import { useTranslation } from "@/lib/i18n";

const GOLD = "#c9a44a";
const GOLD_HOVER = "#d4b560";
const CARD_BG = "#1a2224";
const CARD_BG_HOVER = "#1f2a2c";

type DishCardGoldProps = {
    name: string;
    description?: string | null;
    price: number;
    weight?: number | null;
    imageUrl?: string | null;
    allergens?: string | null;
    priceUnit?: string | null;
};

export default function DishCardGold({
    name,
    description,
    price,
    weight,
    imageUrl,
    priceUnit,
}: DishCardGoldProps) {
    const { price: fmtPrice } = useTranslation();
    const [hovered, setHovered] = useState(false);

    return (
        <article
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: "flex",
                borderRadius: "12px",
                overflow: "hidden",
                background: hovered ? CARD_BG_HOVER : CARD_BG,
                border: `1px solid ${hovered ? "rgba(201,164,74,0.35)" : "rgba(201,164,74,0.15)"}`,
                transition: "all 0.25s ease",
                boxShadow: hovered
                    ? "0 8px 28px rgba(0,0,0,0.45)"
                    : "0 2px 10px rgba(0,0,0,0.3)",
                cursor: "pointer",
                minHeight: "110px",
            }}
        >
            {/* Área izquierda — imagen / placeholder dorado */}
            <div
                style={{
                    position: "relative",
                    width: "130px",
                    flexShrink: 0,
                    background: GOLD,
                    overflow: "hidden",
                    borderRadius: "10px 0 0 10px",
                }}
            >
                {(imageUrl ?? "/images/menu/vinos/vinosTintos/1.png") ? (
                    <Image
                        src={imageUrl ?? "/images/menu/vinos/vinosTintos/1.png"}
                        alt={name}
                        fill
                        sizes="130px"
                        style={{
                            objectFit: "cover",
                            transform: hovered ? "scale(1.07)" : "scale(1)",
                            transition: "transform 0.45s ease",
                        }}
                    />
                ) : null}
            </div>

            {/* Área derecha — contenido */}
            <div
                style={{
                    flex: 1,
                    padding: "1rem 1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                }}
            >
                {/* Nombre + descripción */}
                <div>
                    <h3
                        style={{
                            fontFamily: fonts.primary,
                            fontSize: "0.82rem",
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "#ffffff",
                            margin: "0 0 0.35rem",
                            lineHeight: 1.2,
                        }}
                    >
                        {name}
                    </h3>
                    {description && (
                        <p
                            style={{
                                fontFamily: fonts.primary ?? "'Dancing Script', cursive",
                                fontSize: "0.78rem",
                                color: "rgba(255,255,255,0.45)",
                                margin: 0,
                                lineHeight: 1.45,
                            }}
                        >
                            {description}
                        </p>
                    )}
                </div>

                {/* Precio + peso + ⊕ */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: "0.75rem",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.9rem" }}>
                        <span
                            style={{
                                fontFamily: fonts.primary,
                                fontSize: "1rem",
                                fontWeight: 800,
                                color: hovered ? GOLD_HOVER : GOLD,
                                transition: "color 0.25s ease",
                            }}
                        >
                            {fmtPrice(price)}
                        </span>
                        {priceUnit && (
                            <span
                                style={{
                                    fontFamily: fonts.primary,
                                    fontSize: "0.6rem",
                                    fontWeight: 700,
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase",
                                    color: "rgba(201,164,74,0.6)",
                                }}
                            >
                                {priceUnit}
                            </span>
                        )}
                        {weight && (
                            <span
                                style={{
                                    fontFamily: fonts.primary,
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    letterSpacing: "0.18em",
                                    textTransform: "uppercase",
                                    color: "rgba(255,255,255,0.35)",
                                }}
                            >
                                {weight}GR
                            </span>
                        )}
                    </div>

                    {/* ⊕ */}
                    <div
                        style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            border: `1.5px solid ${hovered ? GOLD_HOVER : "rgba(201,164,74,0.5)"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            background: hovered ? GOLD : "transparent",
                            transition: "all 0.2s ease",
                        }}
                    >
                        <span
                            style={{
                                fontSize: "1rem",
                                lineHeight: 1,
                                color: hovered ? "#111a1c" : GOLD,
                                fontWeight: 300,
                                transition: "color 0.2s ease",
                            }}
                        >
                            +
                        </span>
                    </div>
                </div>
            </div>
        </article>
    );
}
