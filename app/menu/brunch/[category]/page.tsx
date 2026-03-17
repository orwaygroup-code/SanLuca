// ─────────────────────────────────────────────
//  app/menu/brunch/[category]/page.tsx
//  Platillos brunch — identidad azul PDF p.5
// ─────────────────────────────────────────────

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMenuCategoryByName } from "@/lib/db";
import { fonts } from "@/config/theme";
import DishCardBlue from "@/components/menu/DishCardBlue";

// Paleta brunch
const B = {
    bg: "#f0ebe0",
    text: "#1e3a52",
    accent: "#3d6b8c",
    textMuted: "rgba(30,58,82,0.45)",
    border: "rgba(30,58,82,0.1)",
};

type PageProps = {
    params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { category } = await params;
    const name = decodeURIComponent(category);
    const data = await getMenuCategoryByName(`${name} (Brunch)`);
    if (!data) return { title: "Categoría no encontrada" };
    return {
        title: `${data.name} | Brunch | San Luca`,
        description: `Platillos de brunch — ${data.name}`,
    };
}

export default async function BrunchCategoryPage({ params }: PageProps) {
    const { category } = await params;
    const name = decodeURIComponent(category);
    const data = await getMenuCategoryByName(`${name} (Brunch)`);

    if (!data) return notFound();

    return (
        <main
            style={{
                background: B.bg,
                minHeight: "100vh",
                paddingTop: "100px",
                paddingBottom: "5rem",
            }}
        >
            {/* ── TÍTULO — estilo PDF p.5 ── */}
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
                        fontSize: "clamp(5rem, 14vw, 12rem)",
                        fontWeight: 800,
                        color: "rgba(61,107,140,0.06)",
                        textTransform: "uppercase",
                        userSelect: "none",
                        pointerEvents: "none",
                        letterSpacing: "-0.02em",
                    }}
                >
                    {data.name}
                </div>

                <p
                    style={{
                        fontFamily: fonts.primary,
                        fontSize: "0.65rem",
                        letterSpacing: "0.35em",
                        textTransform: "uppercase",
                        color: B.accent,
                        margin: "0 0 0.75rem",
                        position: "relative",
                    }}
                >
                    San Luca · Brunch
                </p>

                {/* BRUNCH big label — PDF p.5 */}
                <h1
                    style={{
                        fontFamily: fonts.primary,
                        fontSize: "clamp(2.5rem, 8vw, 7rem)",
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: B.text,
                        margin: "0 0 0.35rem",
                        lineHeight: 1,
                        position: "relative",
                    }}
                >
                    {data.name.toUpperCase()}
                </h1>

                <p
                    style={{
                        fontFamily: fonts.primary,
                        fontSize: "0.75rem",
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: B.textMuted,
                        margin: 0,
                        position: "relative",
                    }}
                >
                    {data.dishes.length}{" "}
                    {data.dishes.length === 1 ? "platillo" : "platillos"}
                </p>
            </div>

            {/* ── GRID AZUL — PDF p.5 ── */}
            <div
                style={{
                    maxWidth: "1320px",
                    margin: "0 auto",
                    padding: "0 clamp(1.5rem, 4vw, 4rem)",
                }}
            >
                {data.dishes.length === 0 ? (
                    <p
                        style={{
                            textAlign: "center",
                            fontFamily: fonts.primary,
                            fontSize: "0.8rem",
                            letterSpacing: "0.25em",
                            textTransform: "uppercase",
                            color: B.textMuted,
                            padding: "5rem",
                        }}
                    >
                        Próximamente
                    </p>
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
                            <DishCardBlue
                                key={dish.id}
                                name={dish.name}
                                description={dish.description ?? null}
                                price={Number(dish.price)}
                                weight={null}
                                imageUrl={dish.imageUrl ?? null}
                            />
                        ))}
                    </div>
                )}

                <div
                    style={{
                        marginTop: "4rem",
                        paddingTop: "2.5rem",
                        borderTop: `1px solid ${B.border}`,
                        display: "flex",
                        justifyContent: "center",
                    }}
                >
                    <Link href="/menu?mode=brunch" style={{ textDecoration: "none" }}>
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.75rem",
                                padding: "1rem 2.5rem",
                                background: B.accent,
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