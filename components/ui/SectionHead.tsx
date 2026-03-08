"use client";

import { colors, fonts } from "@/config/theme";

interface SectionHeadProps {
  script?: string;
  title: string;
  desc?: string;
  light?: boolean;
}

export function SectionHead({
  script,
  title,
  desc,
  light = false,
}: SectionHeadProps) {
  return (
    <div
      style={{
        textAlign: "center",
        marginBottom: 52,
        maxWidth: 600,
        margin: "0 auto 52px",
      }}
    >
      {script && (
        <div
          style={{
            fontFamily: fonts.script,
            fontSize: "1.4rem",
            color: light ? colors.peru : colors.brown,
            marginBottom: 6,
          }}
        >
          {script}
        </div>
      )}
      <h2
        style={{
          fontFamily: fonts.primary,
          fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
          fontWeight: 800,
          color: light ? colors.cream : colors.dark,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          lineHeight: 1.1,
          margin: "0 0 16px",
        }}
      >
        {title}
      </h2>
      {desc && (
        <p
          style={{
            fontFamily: fonts.primary,
            fontSize: "1.05rem",
            fontWeight: 400,
            color: light
              ? "rgba(245,241,232,0.55)"
              : "rgba(28,38,40,0.5)",
            lineHeight: 1.75,
            margin: 0,
          }}
        >
          {desc}
        </p>
      )}
    </div>
  );
}

interface DividerProps {
  color?: string;
}

export function Divider({ color = colors.peru }: DividerProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        margin: "10px 0",
      }}
    >
      <div
        style={{ width: 36, height: 1.5, background: color, opacity: 0.35 }}
      />
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          border: `1.5px solid ${color}`,
          opacity: 0.5,
        }}
      />
      <div
        style={{ width: 36, height: 1.5, background: color, opacity: 0.35 }}
      />
    </div>
  );
}
