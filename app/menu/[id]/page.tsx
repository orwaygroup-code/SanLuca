// ─────────────────────────────────────────────
//  app/menu/[id]/page.tsx
//  Ruta legacy — compatibilidad con getMenuCategoryById
// ─────────────────────────────────────────────

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMenuCategoryById } from "@/lib/db";
import { fonts, colors } from "@/config/theme";
import DishCardGold from "@/components/menu/DishCardGold";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const category = await getMenuCategoryById(id);
  if (!category) return { title: "Categoría no encontrada" };
  return {
    title: `${category.name} | San Luca`,
    description: `Platillos en ${category.name}`,
  };
}

export default async function MenuCategoryPage({ params }: PageProps) {
  const { id } = await params;
  const category = await getMenuCategoryById(id);

  if (!category) return notFound();

  return (
    <main
      style={{
        background: "#1a2628",
        minHeight: "100vh",
        paddingTop: "100px",
        paddingBottom: "5rem",
      }}
    >
      {/* ── TÍTULO ── */}
      <div
        style={{
          textAlign: "center",
          padding: "2.5rem clamp(1.5rem, 4vw, 4rem) 3.5rem",
          position: "relative",
        }}
      >
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
          {category.name}
        </div>

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

        <h1
          style={{
            fontFamily: fonts.primary,
            fontSize: "clamp(2.5rem, 6vw, 5rem)",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#ffffff",
            margin: "0 0 0.5rem",
            position: "relative",
          }}
        >
          {category.name.toUpperCase()}
        </h1>

        <p
          style={{
            fontFamily: fonts.primary,
            fontSize: "0.75rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.3)",
            margin: 0,
            position: "relative",
          }}
        >
          {category.dishes.length}{" "}
          {category.dishes.length === 1 ? "platillo" : "platillos"}
        </p>
      </div>

      {/* ── GRID ── */}
      <div
        style={{
          maxWidth: "1320px",
          margin: "0 auto",
          padding: "0 clamp(1.5rem, 4vw, 4rem)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(100%, 380px), 1fr))",
            gap: "1rem",
          }}
        >
          {category.dishes.map((dish) => (
            <DishCardGold
              key={dish.id}
              name={dish.name}
              description={dish.description ?? null}
              price={Number(dish.price)}
              weight={(dish as any).weight ?? null}
              imageUrl={dish.imageUrl ?? null}
              allergens={(dish as any).allergens ?? null}
            />
          ))}
        </div>

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