"use client";

import { colors, fonts } from "@/config/theme";
import { Texture, Label, GoldLine } from "@/components/ui/Editorial";
import Reveal from "@/components/ui/Reveal";

const STATS = [
  { number: "1987", label: "Año de fundación" },
  { number: "3", label: "Generaciones" },
  { number: "100%", label: "Artesanal" },
];

export default function ChefStory() {
  return (
    <section
      id="historia"
      style={{
        background: colors.dark,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Texture />

      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "clamp(80px,12vw,160px) clamp(24px,5vw,80px)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
            gap: "clamp(48px,8vw,120px)",
            alignItems: "center",
          }}
        >
          {/* Left — Large headline + Italian quote */}
          <Reveal>
            <Label light> — El origen</Label>
            <h2
              style={{
                fontFamily: fonts.primary,
                fontSize: "clamp(2rem, 4.5vw, 3.4rem)",
                fontWeight: 800,
                color: colors.cream,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                lineHeight: 0.95,
                margin: "12px 0 32px",
              }}
            >
              Nuestra
              <br />
              <span style={{ color: colors.peru }}>Historia</span>
            </h2>
            <div
              style={{
                fontFamily: fonts.script,
                fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
                color: colors.peru,
                lineHeight: 1.3,
                opacity: 0.8,
              }}
            >
              La trayectoria de un sueño materalizado en cada plato.
            </div>
          </Reveal>

          {/* Right — Story paragraphs + stats */}
          <div>
            <Reveal delay={0.15}>
              <GoldLine />
              <p
                style={{
                  fontFamily: fonts.primary,
                  fontSize: "1.05rem",
                  fontWeight: 400,
                  color: "rgba(245,241,232,0.5)",
                  lineHeight: 1.9,
                  marginBottom: 24,
                }}
              >
                San Luca nació en 2020 de la visión de —
                inmigrantes italianos que trajeron consigo algo más que
                recetas: trajeron el alma de la cocina de la Toscana.
              </p>
            </Reveal>

            <Reveal delay={0.25}>
              <p
                style={{
                  fontFamily: fonts.primary,
                  fontSize: "1.05rem",
                  fontWeight: 400,
                  color: "rgba(245,241,232,0.5)",
                  lineHeight: 1.9,
                  marginBottom: 24,
                }}
              >
                Tres generaciones después, cada plato sigue preparándose con
                las mismas manos, los mismos ingredientes, el mismo respeto.
                La nonna que amasaba la pasta al amanecer nos enseñó que
                cocinar no es un oficio — es un acto de amor.
              </p>
            </Reveal>

            <Reveal delay={0.35}>
              <p
                style={{
                  fontFamily: fonts.primary,
                  fontSize: "1.05rem",
                  fontWeight: 400,
                  color: "rgba(245,241,232,0.5)",
                  lineHeight: 1.9,
                  marginBottom: 32,
                }}
              >
                Hoy, ese legado vive en cada rincón de San Luca. En la
                harina que se convierte en tagliatelle. En el ragú que hierve
                seis horas. En la sonrisa de quien sabe que está cocinando
                historia.
              </p>
            </Reveal>

            {/* Stats */}
            <Reveal delay={0.45}>
              <div style={{ display: "flex", gap: 36, flexWrap: "wrap" }}>
                {STATS.map(({ number, label }) => (
                  <div key={label}>
                    <div
                      style={{
                        fontFamily: fonts.primary,
                        fontSize: "2rem",
                        fontWeight: 800,
                        color: colors.peru,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {number}
                    </div>
                    <div
                      style={{
                        fontFamily: fonts.primary,
                        fontSize: "0.65rem",
                        fontWeight: 800,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: "rgba(245,241,232,0.3)",
                        marginTop: 4,
                      }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
