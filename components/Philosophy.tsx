"use client";

import { colors, fonts } from "@/config/theme";
import { Texture, Label, GoldLine, Script } from "@/components/ui/Editorial";
import Reveal from "@/components/ui/Reveal";

export default function Philosophy() {
  return (
    <section
      id="filosofia"
      style={{
        background: colors.cream,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Texture dark={false} />

      {/* Section label */}
      <div
        style={{
          padding: "clamp(80px,12vw,160px) clamp(24px,5vw,80px) 0",
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        <Reveal>
          <Label>01 — Filosofía</Label>
        </Reveal>
      </div>

      {/* Editorial split layout */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "40px clamp(24px,5vw,80px) clamp(80px,12vw,160px)",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 400px), 1fr))",
          gap: "clamp(40px,6vw,100px)",
          alignItems: "start",
        }}
      >
        {/* Left — Large editorial headline */}
        <Reveal delay={0.1}>
          <Script size="clamp(1.2rem, 2vw, 1.6rem)">
            La nostra filosofia
          </Script>
          <h2
            style={{
              fontFamily: fonts.primary,
              fontSize: "clamp(2.4rem, 5vw, 4.2rem)",
              fontWeight: 800,
              color: colors.dark,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              lineHeight: 0.95,
              margin: "12px 0 0",
            }}
          >
            El Arte del
            <br />
            <span style={{ color: colors.peru }}>Origen</span> y
            <br />
<<<<<<< HEAD
              la Tradición
=======
            la Tradición
>>>>>>> d28167aba32c3f2a35f115729458b9eb272d46e4
          </h2>
        </Reveal>

        {/* Right — Body text */}
        <div>
          <Reveal delay={0.25}>
            <GoldLine />
            <p
              style={{
                fontFamily: fonts.primary,
                fontSize: "clamp(1rem, 1.4vw, 1.15rem)",
                fontWeight: 400,
                color: "rgba(28,38,40,0.55)",
                lineHeight: 1.9,
                marginBottom: 28,
              }}
            >
              En San Luca, la alta gastronomía es un arte que nace del
              respeto por el origen y la tradición. Buscamos ofrecerte
              una experiencia sensorial completa, cuidando meticulosamente cada detalle desde la selección del ingrediente hasta tu mesa.
<<<<<<< HEAD
              
=======
>>>>>>> d28167aba32c3f2a35f115729458b9eb272d46e4
            </p>
          </Reveal>

          <Reveal delay={0.35}>
            <p
              style={{
                fontFamily: fonts.primary,
                fontSize: "clamp(1rem, 1.4vw, 1.15rem)",
                fontWeight: 400,
                color: "rgba(28,38,40,0.55)",
                lineHeight: 1.9,
                marginBottom: 28,
              }}
            >
              Nos respaldan dos pilares fundamentales: una
              calidad suprema garantizada a través de productos
              con denominación de origen, y un firme compromiso
              con la sostenibilidad, trabajando de la mano con
              productores responsables.

              En nuestra cocina, elevamos la tradición italiana
              con innovación y excelencia técnica
            </p>
          </Reveal>

          <Reveal delay={0.45}>
            <div
              style={{
                fontFamily: fonts.script,
                fontSize: "clamp(1.4rem, 2.5vw, 2rem)",
                color: colors.brown,
                lineHeight: 1.4,
                margin: "32px 0",
                fontStyle: "italic",
              }}
            >
              &ldquo;Lo más exclusivo del mundo recorriendo continentes hasta llegar a tu mesa.&rdquo;
            </div>
            <Label>— San Luca desde 2020</Label>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
