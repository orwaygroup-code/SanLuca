"use client";

import { colors, fonts } from "@/config/theme";
import { Texture, Label } from "@/components/ui/Editorial";
import Reveal from "@/components/ui/Reveal";

const PILLARS = [
  {
    title: "Aguas de Nueva Zelanda",
    desc: "Salmón Ora King: Textura sedosa y sabor profundo",
  },
  {
    title: "Ensenada, B.C., México",
    desc: "Totoaba, Lubina, Calamares, Almejas & Mejillones, ",
  },
  {
    title: "Océano Atlántico,",
    desc: "Atún Aleta Azul: Corte selecto y jugoso; su grasa natural aporta untuosidad y sabor",
  },
  {
    title: "Atlántico Oriental y Mediterráneo",
    desc: "Pulpo Vulgaris: Carne tierna y jugosa con un sutil toque salino",
  },
  
];

export default function Experience() {
  return (
    <section
      id="experiencia"
      style={{
        background: colors.cream,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Texture dark={false} />

      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "clamp(80px,12vw,160px) clamp(24px,5vw,80px)",
        }}
      >
        <Reveal>
          <Label> — Denominacion&apos;de origen</Label>
        </Reveal>
        <Reveal delay={0.1}>
          <h2
            style={{
              fontFamily: fonts.primary,
              fontSize: "clamp(2rem, 4.5vw, 3.6rem)",
              fontWeight: 800,
              color: colors.dark,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              lineHeight: 0.95,
              margin: "12px 0",
              maxWidth: 600,
            }}
          >
            El Origen
            <br />
            <span style={{ color: colors.peru }}>de la Excelencia</span>
          </h2>
        </Reveal>

        {/* Grid */}
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
