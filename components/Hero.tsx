"use client";

import { colors, fonts } from "@/config/theme";
import Logo from "@/components/ui/Logo";
import Button from "@/components/ui/Button";
import { Divider } from "@/components/ui/SectionHead";

export default function Hero() {
  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(170deg, ${colors.dark} 0%, #263234 50%, ${colors.dark} 100%)`,
      }}
    >
      {/* Stone texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.06,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='t'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='6' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23t)'/%3E%3C/svg%3E")`,
          pointerEvents: "none",
        }}
      />

      {/* Decorative circles */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          right: "-6%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          border: "1px solid rgba(186,132,60,0.06)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "12%",
          left: "-8%",
          width: 380,
          height: 380,
          borderRadius: "50%",
          border: "1px solid rgba(186,132,60,0.04)",
        }}
      />

      {/* Radial accents */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 25% 75%, rgba(186,132,60,0.05) 0%, transparent 50%), radial-gradient(circle at 75% 25%, rgba(171,62,42,0.03) 0%, transparent 50%)",
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div
        style={{
          textAlign: "center",
          zIndex: 1,
          padding: "0 24px",
          maxWidth: 700,
        }}
      >
        <div
          style={{
            fontFamily: fonts.script,
            fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)",
            color: colors.peru,
            marginBottom: 24,
            opacity: 0.8,
            animation: "fadeUp 0.9s ease 0.2s both",
          }}
        >
          Auténtica cocina italiana
        </div>

        <div style={{ animation: "fadeUp 0.9s ease 0.4s both" }}>
          <Logo size="xl" variant="peru" />
        </div>

        <div
          style={{
            margin: "32px 0",
            animation: "fadeUp 0.9s ease 0.7s both",
          }}
        >
          <Divider color="rgba(186,132,60,0.35)" />
        </div>

        <p
          style={{
            fontFamily: fonts.primary,
            fontSize: "clamp(0.95rem, 1.8vw, 1.1rem)",
            color: "rgba(245,241,232,0.5)",
            lineHeight: 1.8,
            fontWeight: 400,
            maxWidth: 450,
            margin: "0 auto 36px",
            animation: "fadeUp 0.9s ease 0.9s both",
          }}
        >
          Donde la tradición italiana se encuentra con la pasión artesanal.
          Cada plato cuenta una historia de familia.
        </p>

        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            flexWrap: "wrap",
            animation: "fadeUp 0.9s ease 1.1s both",
          }}
        >
          <Button>Reservar Mesa</Button>
          <Button variant="outline">Ver Menú</Button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 36,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          animation: "pulse 2.5s ease infinite",
        }}
      >
        <div
          style={{
            width: 1,
            height: 36,
            background: `linear-gradient(to bottom, transparent, ${colors.peru})`,
          }}
        />
        <div
          style={{
            width: 18,
            height: 28,
            borderRadius: 9,
            border: "1.5px solid rgba(186,132,60,0.35)",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 3,
              height: 7,
              background: colors.peru,
              borderRadius: 2,
              position: "absolute",
              top: 5,
              left: "50%",
              transform: "translateX(-50%)",
              animation: "scrollDot 2s ease infinite",
            }}
          />
        </div>
      </div>
    </section>
  );
}
