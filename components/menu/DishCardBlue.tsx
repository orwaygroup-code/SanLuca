"use client";

import Image from "next/image";
import { useState } from "react";
import { fonts } from "@/config/theme";

const BLUE = "#6b8dab";
const BLUE_HOVER = "#7a9dbd";
const BLUE_IMG = "#547290";
const TEXT = "#1e3a52";
const CARD_BG = "#ffffff";

type DishCardBlueProps = {
    name: string;
    description?: string | null;
    price: number;
    weight?: number | null;
    imageUrl?: string | null;
};

export default function DishCardBlue({
    name,
    description,
    price,
    weight,
    imageUrl,
}: DishCardBlueProps) {
    const [hovered, setHovered] = useState(false);

    return (
        <article
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: "flex",
                borderRadius: "14px",
                overflow: "hidden",
                background: CARD_BG,
                border: `1.5px solid ${hovered ? BLUE_HOVER : BLUE}`,
                transition: "all 0.25s ease",
                boxShadow: hovered
                    ? "0 8px 28px rgba(30,58,82,0.2)"
                    : "0 2px 10px rgba(30,58,82,0.1)",
                cursor: "pointer",
                minHeight: "110px",
            }}
        >
            {/* Área izquierda — imagen / placeholder */}
            <div
                style={{
                    position: "relative",
                    width: "130px",
                    flexShrink: 0,
                    background: BLUE_IMG,
                    overflow: "hidden",
                    borderRadius: "12px 0 0 12px",
                }}
            >
                {imageUrl ? (
                    <Image
                        src={imageUrl}
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
                            color: TEXT,
                            margin: "0 0 0.35rem",
                            lineHeight: 1.2,
                        }}
                    >
                        {name}
                    </h3>
                    {description && (
                        <p
                            style={{
                                fontFamily: fonts.primary,
                                fontSize: "0.75rem",
                                fontWeight: 400,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                color: "rgba(30,58,82,0.55)",
                                margin: 0,
                                lineHeight: 1.5,
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
                                color: TEXT,
                            }}
                        >
                            ${price.toFixed(0)}
                        </span>
                        {weight && (
                            <span
                                style={{
                                    fontFamily: fonts.primary,
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    letterSpacing: "0.18em",
                                    textTransform: "uppercase",
                                    color: "rgba(30,58,82,0.5)",
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
                            border: `1.5px solid ${hovered ? TEXT : "rgba(30,58,82,0.6)"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            background: hovered ? TEXT : "transparent",
                            transition: "all 0.2s ease",
                        }}
                    >
                        <span
                            style={{
                                fontSize: "1rem",
                                lineHeight: 1,
                                color: hovered ? BLUE : TEXT,
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
