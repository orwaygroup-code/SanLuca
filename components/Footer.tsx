"use client";

import { useState } from "react";
import { colors, fonts } from "@/config/theme";
import { useTranslation } from "@/lib/i18n";

function FooterColumn({
  title,
  lines,
}: {
  title: string;
  lines: string[];
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: fonts.primary,
          fontSize: "0.62rem",
          fontWeight: 800,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: colors.peru,
          marginBottom: 14,
        }}
      >
        {title}
      </div>
      {lines.map((line) => (
        <p
          key={line}
          style={{
            fontFamily: fonts.primary,
            fontSize: "0.88rem",
            fontWeight: 400,
            color: "rgba(245,241,232,0.35)",
            margin: "0 0 4px",
            lineHeight: 1.6,
          }}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

function SocialLink({ label }: { label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href="#"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: fonts.primary,
        fontSize: "0.62rem",
        fontWeight: 800,
        color: hovered ? colors.peru : "rgba(245,241,232,0.25)",
        textDecoration: "none",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        transition: "color 0.3s",
      }}
    >
      {label}
    </a>
  );
}

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer
      style={{
        background: colors.dark,
        borderTop: "1px solid rgba(186,132,60,0.08)",
        padding:
          "clamp(48px,6vw,72px) clamp(24px,5vw,80px) 28px",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "clamp(32px,4vw,48px)",
            marginBottom: 48,
          }}
        >
          {/* Brand */}
          <div>
            <div
              style={{
                fontFamily: fonts.primary,
                fontWeight: 800,
                fontSize: "1.4rem",
                color: colors.cream,
                lineHeight: 0.85,
                marginBottom: 16,
              }}
            >
              SAN
              <br />
              LUCA
            </div>
            <div
              style={{
                fontFamily: fonts.script,
                fontSize: "0.5rem",
                color: colors.cream,
                opacity: 0.6,
              }}
            >
              Ristorante
            </div>
          </div>

          <FooterColumn
            title={t.footer.sections.visit}
            lines={[
              "Paseos de las Maravillas 113",
              "El llano",
              "Aguascalientes, Ags.",
            ]}
          />

          <FooterColumn
            title={t.footer.hours}
            lines={t.footer.schedule}
          />

          <FooterColumn
            title={t.footer.contactTitle}
            lines={[
              "+52 449 287 3674",
              "sanlucaterrazza@gmail.com",
            ]}
          />
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: "1px solid rgba(186,132,60,0.06)",
            paddingTop: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: fonts.primary,
              fontSize: "0.7rem",
              fontWeight: 400,
              color: "rgba(245,241,232,0.2)",
            }}
          >
            © 2026 San Luca Ristorante | {t.footer.developedBy}
          </span>
          <div style={{ display: "flex", gap: 20 }}>
            <SocialLink label="Instagram" />
            <SocialLink label="Facebook" />
          </div>
        </div>
      </div>
    </footer>
  );
}
