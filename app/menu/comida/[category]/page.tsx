// ─────────────────────────────────────────────
//  app/menu/comida/[category]/page.tsx
//  PDF Página 4 — Título categoría + grid dorado de platillos
// ─────────────────────────────────────────────

import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMenuCategoryByName } from "@/lib/db";
import { fonts, colors } from "@/config/theme";
import DishCardGold from "@/components/menu/DishCardGold";

type PageProps = {
    params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { category } = await params;
    const data = await getMenuCategoryByName(decodeURIComponent(category));
    if (!data) return { title: "Categoría no encontrada" };
    return {
        title: `${data.name} | San Luca`,
        description: `Platillos en ${data.name}`,
    };
}

export default async function ComidaCategoryPage({ params }: PageProps) {
    const { category } = await params;
    const data = await getMenuCategoryByName(decodeURIComponent(category));

    if (!data) return notFound();

    return (
        <main
            style={{
                background: "#1a2628",
                minHeight: "100vh",
                paddingTop: "100px",
                paddingBottom: "5rem",
            }}
        >
            {/* ── PORTADA ── */}
            {data.imageUrl && (
                <div style={{ position: "relative", width: "100%", height: "clamp(200px, 35vw, 420px)" }}>
                    <Image
                        src={data.imageUrl}
                        alt={data.name}
                        fill
                        priority
                        sizes="100vw"
                        style={{ objectFit: "cover" }}
                    />
                    <div style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(to bottom, rgba(26,38,40,0) 40%, rgba(26,38,40,1) 100%)",
                    }} />
                </div>
            )}

            {/* ── TÍTULO CATEGORÍA (PDF p.4) ── */}
            <div
                style={{
                    textAlign: "center",
                    padding: "2.5rem clamp(1.5rem, 4vw, 4rem) 3.5rem",
                    position: "relative",
                }}
            >
                {/* Watermark */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: fonts.primary,
                        fontSize: "clamp(5rem, 14vw, 11rem)",
                        fontWeight: 800,
                        color: "rgba(201,150,74,0.04)",
                        textTransform: "uppercase",

                        userSelect: "none",
                        pointerEvents: "none",
                    }}
                >
                    {data.name}
                </div>

                <p
                    style={{
                        fontFamily: fonts.primary,
                        fontSize: "0.65rem",
                        textTransform: "uppercase",
                        color: colors.peru,
                        margin: "0 0 0.75rem",
                        position: "relative",
                    }}
                >
                    San Luca · Comida
                </p>

                <h1
                    style={{
                        fontFamily: fonts.primary,
                        fontSize: "clamp(2.5rem, 6vw, 5rem)",
                        fontWeight: 700,

                        textTransform: "uppercase",
                        color: "#ffffff",
                        margin: "0 0 0.5rem",
                        position: "relative",
                    }}
                >
                    {data.name.toUpperCase()}
                </h1>

                <p
                    style={{
                        fontFamily: fonts.primary,
                        fontSize: "0.75rem",

                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.3)",
                        margin: 0,
                        position: "relative",
                    }}
                >
                    {data.dishes.length}{" "}
                    {data.dishes.length === 1 ? "platillo" : "platillos"}
                </p>
            </div>

            {/* ── GRID DORADO DE PLATILLOS (PDF p.4) ── */}
            <div
                style={{
                    maxWidth: "1320px",
                    margin: "0 auto",
                    padding: "0 clamp(1.5rem, 4vw, 4rem)",
                }}
            >
                {data.dishes.length === 0 ? (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "5rem",
                            color: "rgba(255,255,255,0.3)",
                        }}
                    >
                        <p
                            style={{
                                fontFamily: fonts.primary,
                                fontSize: "0.8rem",

                                textTransform: "uppercase",
                            }}
                        >
                            Próximamente
                        </p>
                    </div>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fill, minmax(min(100%, 380px), 1fr))",
                            gap: "1rem",
                        }}
                    >
                        {data.dishes.map((dish: typeof data.dishes[number]) => (
                            <DishCardGold
                                key={dish.id}
                                name={dish.name}
                                description={dish.description ?? null}
                                price={Number(dish.price)}
                                weight={null}
                                imageUrl={dish.imageUrl ?? null}
                                priceUnit={data.name === "Carne Wagyu" ? "por cada 100g" : null}
                            />
                        ))}
                    </div>
                )}

                {/* Back */}
                <div
                    style={{
                        marginTop: "4rem",
                        paddingTop: "2.5rem",
                        borderTop: "1px solid rgba(255,255,255,0.07)",
                        display: "flex",
                        justifyContent: "center",
                    }}
                >
                    <Link href="/menu" style={{ textDecoration: "none" }}>
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.75rem",
                                padding: "1rem 2.5rem",
                                background: colors.peru,
                                color: "#ffffff",
                                fontFamily: fonts.primary,
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                letterSpacing: "0.25em",
                                textTransform: "uppercase",
                                cursor: "pointer",
                                transition: "all 0.25s ease",
                                borderRadius: "2px",
                            }}
                        >
                            <span style={{ fontSize: "1rem", lineHeight: 1 }}>←</span>
                            Volver al menú
                        </div>
                    </Link>
                </div>
            </div>
        </main>
    );
}