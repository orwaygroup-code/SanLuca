"use client";

import { useState } from "react";
import { colors, fonts } from "@/config/theme";
import Logo from "@/components/ui/Logo";

const HOURS = [
  ["Lun – Vie", "13:00 – 23:00"],
  ["Sábado", "12:00 – 00:00"],
  ["Domingo", "12:00 – 22:00"],
];

const CONTACT = [
  "Av. de la Convención 312",
  "Col. Centro, Aguascalientes",
  "+52 (449) 123 4567",
  "info@sanluca.mx",
];

const SOCIAL = ["Instagram", "Facebook", "TripAdvisor"];

function SocialLink({ label }: { label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href="#"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: fonts.primary,
        fontSize: "0.7rem",
        fontWeight: 800,
        color: hovered ? colors.peru : "rgba(245,241,232,0.3)",
        textDecoration: "none",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        transition: "color 0.3s",
      }}
    >
      {label}
    </a>
  );
}

export default function Footer() {
  return (
    <footer
      style={{
        background: colors.dark,
        borderTop: "1px solid rgba(186,132,60,0.1)",
        padding: "56px 24px 28px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 36,
            marginBottom: 44,
          }}
        >
          {/* Brand */}
          <div>
            <Logo size="sm" variant="cream" />
            <p
              style={{
                fontFamily: fonts.primary,
                fontSize: "0.9rem",
                fontWeight: 400,
                color: "rgba(245,241,232,0.38)",
                lineHeight: 1.7,
                marginTop: 16,
              }}
            >
              Auténtica cocina italiana desde 1987. Donde cada plato cuenta
              una historia.
            </p>
          </div>

          {/* Hours */}
          <div>
            <h4
              style={{
                fontFamily: fonts.primary,
                fontSize: "0.7rem",
                fontWeight: 800,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: colors.peru,
                marginBottom: 14,
              }}
            >
              Horario
            </h4>
            {HOURS.map(([day, time]) => (
              <div
                key={day}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: fonts.primary,
                  fontSize: "0.88rem",
                  fontWeight: 400,
                  color: "rgba(245,241,232,0.4)",
                  marginBottom: 7,
                }}
              >
                <span>{day}</span>
                <span style={{ color: colors.cream }}>{time}</span>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div>
            <h4
              style={{
                fontFamily: fonts.primary,
                fontSize: "0.7rem",
                fontWeight: 800,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: colors.peru,
                marginBottom: 14,
              }}
            >
              Contacto
            </h4>
            {CONTACT.map((line) => (
              <p
                key={line}
                style={{
                  fontFamily: fonts.primary,
                  fontSize: "0.88rem",
                  fontWeight: 400,
                  color: "rgba(245,241,232,0.4)",
                  margin: "0 0 5px",
                }}
              >
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: "1px solid rgba(186,132,60,0.08)",
            paddingTop: 22,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <p
            style={{
              fontFamily: fonts.primary,
              fontSize: "0.78rem",
              fontWeight: 400,
              color: "rgba(245,241,232,0.25)",
              margin: 0,
            }}
          >
            © 2026 San Luca Ristorante
          </p>
          <div style={{ display: "flex", gap: 18 }}>
            {SOCIAL.map((s) => (
              <SocialLink key={s} label={s} />
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
