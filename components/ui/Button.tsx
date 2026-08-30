"use client";

import { useState } from "react";
import { colors, fonts } from "@/config/theme";

interface ButtonProps {
  children: React.ReactNode;
  href?: string;
  dark?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function Button({
  children,
  href = "#",
  dark = false,
  onClick,
  style = {},
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);

  const base: React.CSSProperties = {
    display: "inline-block",
    fontFamily: fonts.secondary,
    fontSize: "0.9rem",
    fontWeight: 800,
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    padding: "16px 44px",
    background: dark ? (hovered ? colors.brown : colors.peru) : "transparent",
    color: dark ? colors.white : hovered ? colors.peru : colors.cream,
    border: dark ? "none" : `1.5px solid ${hovered ? colors.peru : "rgb(var(--sl-cream-rgb) / 0.25)"}`,
    textDecoration: "none",
    transition: "all 0.4s cubic-bezier(.25,.46,.45,.94)",
    transform: hovered ? "translateY(-1px)" : "none",
    boxShadow: dark && hovered ? "0 8px 28px rgb(var(--sl-gold-rgb) / 0.3)" : "none",
    cursor: "pointer",
    ...style,
  };

  if (onClick) {
    return (
      <button
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onClick}
        style={{ ...base, borderRadius: 0 }}
      >
        {children}
      </button>
    );
  }

  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={base}
    >
      {children}
    </a>
  );
}
