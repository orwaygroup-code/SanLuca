import Link from "next/link";
import { getMenuCategories } from "@/lib/db";
import type { Metadata } from "next";
import Reveal from "@/components/ui/Reveal";
import { Texture } from "@/components/ui/Editorial";
import { fonts, colors } from "@/config/theme";
import { Label } from "@/components/ui/Editorial";

export const metadata: Metadata = {
  title: "Menú",
  description: "Explora nuestro menú",
};

const PILLARS = [
  {
    title: "Ingredientes Artesanales",
    desc: "Seleccionados diariamente de productores locales y mercados italianos",
  },
  {
    title: "Pasta Fresca Diaria",
    desc: "Elaborada a mano cada mañana con técnicas de la Emilia-Romaña",
  },
  {
    title: "Vinos de Reserva",
    desc: "Carta curada con etiquetas de la Toscana, Piamonte y Sicilia",
  },
  {
    title: "Ambiente Íntimo",
    desc: "Espacios diseñados para crear momentos memorables",
  },
];

export default async function MenuPage() {
  const categories = await getMenuCategories();

  return (
    <section
      style={{
        padding: "5rem 2rem",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      {/* HEADER PRINCIPAL */}
      <Reveal>
        <h1
          style={{
            fontFamily: fonts.primary,
            fontSize: "clamp(2.8rem,5vw,4rem)",
            fontWeight: 300,
            letterSpacing: "0.05em",
            marginBottom: "0.5rem",
            color: colors.dark,
          }}
        >
          Nuestro <span style={{ color: colors.peru }}>Menú</span>
        </h1>

        <p
          style={{
            fontSize: "1rem",
            color: "rgba(28,38,40,0.6)",
            marginBottom: "3rem",
          }}
        >
          Selecciona una categoría para explorar
        </p>
      </Reveal>

      {/* GRID DE CATEGORÍAS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "2rem",
        }}
      >
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/menu/${category.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <article
              style={{
                border: "1px solid rgba(28,38,40,0.08)",
                padding: "2rem",
                borderRadius: "4px",
                transition: "all 0.25s ease",
              }}
            >
              <h2
                style={{
                  fontFamily: fonts.primary,
                  fontWeight: 500,
                  fontSize: "1.4rem",
                  marginBottom: "0.5rem",
                }}
              >
                {category.name}
              </h2>

              <p
                style={{
                  fontSize: "0.875rem",
                  color: "rgba(28,38,40,0.5)",
                }}
              >
                {category.dishes.length} platillos
              </p>
            </article>
          </Link>
        ))}
      </div>

      <Texture dark={false} />

      {/* SECCIÓN SECUNDARIA */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          marginTop: "80px",
        }}
      >
        <Reveal delay={0.1}>
          <Label>La Casa</Label>

          <h2
            style={{
              fontFamily: fonts.primary,
              fontSize: "clamp(1.6rem,2.5vw,2rem)",
              fontWeight: 300,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(28,38,40,0.6)",
              marginTop: "10px",
            }}
          >
            Una Experiencia{" "}
            <span style={{ color: colors.peru }}>Completa</span>
          </h2>
        </Reveal>

        {/* GRID PILARES */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: 0,
            marginTop: "clamp(48px,6vw,80px)",
            borderTop: "1px solid rgba(28,38,40,0.08)",
          }}
        >
          {PILLARS.map((p, i) => (
            <Reveal
              key={p.title}
              delay={i * 0.1}
              style={{
                padding: "clamp(28px,3vw,44px) clamp(20px,2vw,32px)",
                borderBottom: "1px solid rgba(28,38,40,0.08)",
                borderRight: "1px solid rgba(28,38,40,0.08)",
              }}
            >
              <div
                style={{
                  fontFamily: fonts.primary,
                  fontSize: "3rem",
                  fontWeight: 800,
                  color: "rgba(186,132,60,0.1)",
                  lineHeight: 1,
                  marginBottom: 16,
                }}
              >
                0{i + 1}
              </div>

              <h4
                style={{
                  fontFamily: fonts.primary,
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  color: colors.dark,
                  letterSpacing: "0.04em",
                  margin: "0 0 8px",
                }}
              >
                {p.title}
              </h4>

              <p
                style={{
                  fontFamily: fonts.primary,
                  fontSize: "0.9rem",
                  fontWeight: 400,
                  color: "rgba(28,38,40,0.45)",
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {p.desc}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}