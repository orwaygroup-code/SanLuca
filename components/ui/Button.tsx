"use client";

import { useState } from "react";
import { colors, fonts } from "@/config/theme";

interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "outline";
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function Button({
  children,
  variant = "primary",
  onClick,
  style = {},
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);

  const base: React.CSSProperties = {
    fontFamily: fonts.primary,
    fontSize: "0.82rem",
    fontWeight: 800,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    padding: "15px 38px",
    border: "none",
    borderRadius: 0,
    cursor: "pointer",
    transition: "all 0.4s cubic-bezier(.25,.46,.45,.94)",
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: hovered ? colors.brown : colors.peru,
      color: colors.white,
      boxShadow: hovered
        ? "0 10px 30px rgba(186,132,60,0.35)"
        : "0 4px 16px rgba(186,132,60,0.18)",
      transform: hovered ? "translateY(-2px)" : "none",
    },
    outline: {
      background: "transparent",
      color: hovered ? colors.peru : colors.cream,
      border: `2px solid ${hovered ? colors.peru : "rgba(245,241,232,0.3)"}`,
    },
  };

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}
