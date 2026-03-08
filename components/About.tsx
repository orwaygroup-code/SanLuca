"use client";

import { useState } from "react";
import { colors, fonts } from "@/config/theme";
import { SectionHead } from "@/components/ui/SectionHead";

const FEATURES = [
  {
    icon: "🌿",
    title: "Ingredientes Frescos",
    desc: "Seleccionamos diariamente los mejores ingredientes locales e importados directamente de Italia.",
  },
  {
    icon: "👨‍🍳",
    title: "Recetas de Familia",
    desc: "Cada plato lleva el legado de tres generaciones de cocineros italianos apasionados.",
  },
  {
    icon: "🍷",
    title: "Vinos Selectos",
    desc: "Nuestra carta de vinos recorre las mejores regiones vinícolas de la Toscana y el Piamonte.",
  },
];

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: colors.white,
        padding: "44px 32px",
        textAlign: "center",
        transition: "all 0.5s cubic-bezier(.25,.46,.45,.94)",
        transform: hovered ? "translateY(-5px)" : "none",
        boxShadow: hovered
          ? "0 18px 48px rgba(28,38,40,0.1), 0 0 0 1px rgba(186,132,60,0.08)"
          : "0 2px 16px rgba(28,38,40,0.03)",
        border: `1px solid ${hovered ? "rgba(186,132,60,0.12)" : "rgba(28,38,40,0.03)"}`,
      }}
    >
      <div style={{ fontSize: "2.2rem", marginBottom: 18 }}>{icon}</div>
      <h3
        style={{
          fontFamily: fonts.primary,
          fontSize: "1.15rem",
          fontWeight: 800,
          color: colors.dark,
          marginBottom: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: fonts.primary,
          fontSize: "0.95rem",
          fontWeight: 400,
          color: "rgba(28,38,40,0.5)",
          lineHeight: 1.75,
          margin: 0,
        }}
      >
        {desc}
      </p>
    </div>
  );
}

export default function About() {
  return (
    <section
      id="about"
      style={{
        background: colors.cream,
        padding: "clamp(64px, 10vw, 120px) 24px",
        position: "relative",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
        <SectionHead
          script="La nostra storia"
          title="Tradición desde 1987"
          desc="Tres generaciones de pasión por la cocina italiana auténtica. Cada ingrediente seleccionado con cuidado, cada receta heredada con amor."
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 28,
            marginTop: 48,
          }}
        >
          {FEATURES.map((f, i) => (
            <FeatureCard key={i} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}
