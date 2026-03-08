"use client";

import { useState } from "react";
import { colors, fonts } from "@/config/theme";
import { SectionHead } from "@/components/ui/SectionHead";

const QUOTES = [
  {
    text: "La mejor experiencia italiana que hemos tenido fuera de Italia. Cada detalle, impecable.",
    name: "María González",
    role: "Food Blogger",
  },
  {
    text: "El risotto ai funghi porcini me transportó directamente a la Toscana. Extraordinario.",
    name: "Carlos Ramírez",
    role: "Chef Ejecutivo",
  },
  {
    text: "San Luca no es solo un restaurante, es un viaje sensorial a través de la gastronomía italiana.",
    name: "Ana Martínez",
    role: "Crítica Gastronómica",
  },
];

function QuoteCard({
  text,
  name,
  role,
}: {
  text: string;
  name: string;
  role: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? "rgba(186,132,60,0.06)"
          : "rgba(245,241,232,0.02)",
        border: `1px solid ${hovered ? "rgba(186,132,60,0.15)" : "rgba(245,241,232,0.05)"}`,
        padding: "34px 26px",
        transition: "all 0.4s",
      }}
    >
      <div
        style={{
          fontFamily: fonts.script,
          fontSize: "2.4rem",
          color: colors.peru,
          lineHeight: 0.8,
          marginBottom: 14,
        }}
      >
        &ldquo;
      </div>
      <p
        style={{
          fontFamily: fonts.primary,
          fontSize: "0.98rem",
          fontWeight: 400,
          color: "rgba(245,241,232,0.65)",
          lineHeight: 1.7,
          fontStyle: "italic",
          margin: "0 0 22px",
        }}
      >
        {text}
      </p>
      <div
        style={{
          fontFamily: fonts.primary,
          fontSize: "0.9rem",
          fontWeight: 800,
          color: colors.cream,
          letterSpacing: "0.04em",
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontFamily: fonts.script,
          fontSize: "0.9rem",
          color: colors.peru,
          marginTop: 2,
        }}
      >
        {role}
      </div>
    </div>
  );
}

export default function Testimonials() {
  return (
    <section
      style={{
        background: `linear-gradient(175deg, #263234 0%, ${colors.dark} 100%)`,
        padding: "clamp(64px, 10vw, 100px) 24px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <SectionHead
          script="Testimonianze"
          title="Nuestros Invitados"
          light
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          {QUOTES.map((q, i) => (
            <QuoteCard key={i} {...q} />
          ))}
        </div>
      </div>
    </section>
  );
}
