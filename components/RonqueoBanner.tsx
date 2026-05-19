"use client";

import Link from "next/link";
import { colors, fonts } from "@/config/theme";
import Reveal from "@/components/ui/Reveal";

/**
 * Banner promocional del evento RONQUEO OMAKASE — viernes 29 de mayo, 7:00 PM.
 * Se monta entre Hero y Philosophy en `app/page.tsx`.
 * Para retirarlo después del evento basta con remover el componente de la página.
 */
export default function RonqueoBanner() {
  return (
    <section
      id="ronqueo"
      style={{
        position: "relative",
        background: `radial-gradient(circle at 70% 30%, rgba(186,132,60,0.10), transparent 55%), ${colors.dark}`,
        padding: "clamp(60px,8vw,110px) clamp(20px,5vw,80px)",
        overflow: "hidden",
      }}
    >
      {/* Gold glow accents */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-20%",
          left: "-10%",
          width: "40%",
          height: "60%",
          background: "radial-gradient(circle, rgba(186,132,60,0.12), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: "-30%",
          right: "-10%",
          width: "50%",
          height: "70%",
          background: "radial-gradient(circle, rgba(171,62,42,0.10), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Eyebrow: pulsing badge */}
        <Reveal>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 18px",
              border: `1px solid ${colors.peru}`,
              borderRadius: 999,
              marginBottom: 28,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: colors.peru,
                animation: "ronqueo-pulse 1.6s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontFamily: fonts.primary,
                fontSize: "0.68rem",
                fontWeight: 800,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: colors.peru,
              }}
            >
              Próximo evento
            </span>
          </div>
        </Reveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
            gap: "clamp(32px,5vw,72px)",
            alignItems: "center",
          }}
        >
          {/* Left — Image with gold frame */}
          <Reveal delay={0.1}>
            <div
              style={{
                position: "relative",
                borderRadius: 14,
                overflow: "hidden",
                border: `1px solid rgba(186,132,60,0.4)`,
                boxShadow:
                  "0 30px 70px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(186,132,60,0.15)",
                aspectRatio: "16 / 9",
                background: colors.dark,
              }}
            >
              <img
                src="/images/ronqueos/ronqueo.png"
                alt="Ronqueo Omakase — Viernes 29 de mayo, 7:00 PM en San Luca Ristorante"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
          </Reveal>

          {/* Right — Copy + CTAs */}
          <div>
            <Reveal delay={0.2}>
              <div
                style={{
                  fontFamily: fonts.script,
                  fontSize: "clamp(1.4rem, 2.2vw, 1.9rem)",
                  color: colors.peru,
                  marginBottom: 8,
                  lineHeight: 1,
                }}
              >
                Una noche irrepetible
              </div>
              <h2
                style={{
                  fontFamily: fonts.primary,
                  fontSize: "clamp(2.2rem, 4.5vw, 3.6rem)",
                  fontWeight: 800,
                  color: colors.cream,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  lineHeight: 0.95,
                  margin: "8px 0 20px",
                }}
              >
                Ronqueo
                <br />
                <span style={{ color: colors.peru }}>Omakase</span>
              </h2>
            </Reveal>

            <Reveal delay={0.3}>
              {/* Event details list */}
              <ul
                style={{
                  listStyle: "none",
                  margin: "0 0 28px",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <DetailRow label="Fecha"  value="Viernes 29 de mayo · 7:00 PM" />
                <DetailRow label="Precio" value="$1,550 MXN por persona" />
                <DetailRow label="Cupo"   value="Limitado" />
                <DetailRow label="Nota"   value="No incluye bebidas" />
              </ul>
            </Reveal>

            <Reveal delay={0.4}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <Link
                  href="/reservation"
                  style={{
                    display: "inline-block",
                    padding: "14px 28px",
                    background: colors.peru,
                    color: colors.dark,
                    fontFamily: fonts.primary,
                    fontWeight: 800,
                    fontSize: "0.78rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                    borderRadius: 4,
                    transition: "background 0.2s, transform 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#d09a52";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.peru;
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  Reservar mi lugar
                </Link>
                <a
                  href="tel:+524492873674"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "14px 24px",
                    background: "transparent",
                    color: colors.cream,
                    fontFamily: fonts.primary,
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                    border: "1px solid rgba(245,241,232,0.25)",
                    borderRadius: 4,
                    transition: "border-color 0.2s, color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.peru;
                    e.currentTarget.style.color = colors.peru;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(245,241,232,0.25)";
                    e.currentTarget.style.color = colors.cream;
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  449 287 3674
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ronqueo-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(186,132,60,0.6); transform: scale(1); }
          50%      { box-shadow: 0 0 0 8px rgba(186,132,60,0); transform: scale(1.15); }
        }
      `}</style>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 18,
        alignItems: "baseline",
        paddingBottom: 8,
        borderBottom: "1px solid rgba(245,241,232,0.08)",
      }}
    >
      <span
        style={{
          fontFamily: fonts.primary,
          fontSize: "0.66rem",
          fontWeight: 800,
          color: colors.peru,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          minWidth: 70,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: fonts.primary,
          fontSize: "clamp(0.95rem, 1.2vw, 1.05rem)",
          color: colors.cream,
        }}
      >
        {value}
      </span>
    </li>
  );
}
