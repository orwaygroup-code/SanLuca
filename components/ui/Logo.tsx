"use client";

import { colors, fonts } from "@/config/theme";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "peru" | "dark" | "cream" | "brown";
}

export default function Logo({ size = "lg", variant = "peru" }: LogoProps) {
  const scale = { sm: 1.1, md: 1.6, lg: 2.8, xl: 5 }[size];
  const color = colors[variant] || colors.peru;

  return (
    <div
      style={{
        fontFamily: fonts.primary,
        textAlign: "center",
        lineHeight: 0.88,
        letterSpacing: "0.12em",
        userSelect: "none",
      }}
    >
      <div
        style={{
          fontSize: `${scale}rem`,
          fontWeight: 800,
          color,
          textTransform: "uppercase",
        }}
      >
        SAN
      </div>
      <div
        style={{
          fontSize: `${scale}rem`,
          fontWeight: 800,
          color,
          textTransform: "uppercase",
        }}
      >
        LUCA
      </div>
      <div
        style={{
          fontFamily: fonts.script,
          fontSize: `${scale * 0.38}rem`,
          color,
          opacity: 0.85,
          letterSpacing: "0.04em",
          marginTop: scale * 2,
          fontWeight: 400,
        }}
      >
        Ristorante
      </div>
    </div>
  );
}
