"use client";

import { useState, useEffect } from "react";
import { colors, fonts } from "@/config/theme";
import { Texture, Label, GoldLine } from "@/components/ui/Editorial";
import Button from "@/components/ui/Button";
import Image from "next/image";

const images = [
  "/images/hero/1b.png",
  "/images/hero/2b.png",
  "/images/hero/3b.png",
  "/images/hero/4b.png",
  "/images/hero/5b.png",
  "/images/hero/6b.png",
  "/images/hero/7b.png"
];
const randomImage = images[Math.floor(Math.random() * images.length)];


export default function Hero() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: colors.dark,
        position: "relative",
        overflow: "hidden",
      }}
    >

      <Texture />

      {/* Radial color accents */}

      <div className="relative w-full aspect-[9/16]">
        <Image
          src={randomImage}
          alt="Comunidad de la fundación participando en actividades"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
          quality={85}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/80" />      </div>
      <div

      // style={{
      //   position: "absolute",
      //   inset: 0,
      //   background:
      //     "radial-gradient(ellipse at 30% 70%, rgb(51,86,137) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgb(51,86,137) 0%, transparent 60%)",
      //   pointerEvents: "none",
      // }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        {/* Top label */}
        <div
          style={{
            fontFamily: fonts.primary,
            fontSize: "10rem",
            color: colors.cream,
            lineHeight: 0.82,
            textShadow: "0 4px 20px rgba(0,0,0,0.6)",
          }}
        >
          <Label light>POR: RICARDO CAMACHO Y FRANCCESCA METTE</Label>
        </div>

        {/* Logo */}
        <div
          style={{
            margin: "40px 0 12px",
            opacity: loaded ? 1 : 0,
            transform: loaded ? "none" : "translateY(30px)",
            transition: "all 1.2s cubic-bezier(.16,1,.3,1) 0.5s",
          }}
        >
          <div
            style={{
              fontFamily: fonts.primary,
              fontSize: "10rem",
              color: colors.cream,
              lineHeight: 0.82,
            }}
          >
            SAN
            <br />
            LUCA
          </div>
          <div
            style={{
              fontFamily: fonts.script,
              fontSize: "clamp(1.2rem, 3vw, 2rem)",
              color: colors.cream,

              opacity: 0.7,
              marginTop: 12,
            }}
          >
            Ristorante
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            opacity: loaded ? 1 : 0,
            transition: "opacity 1.2s ease 1.2s",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <GoldLine width={48} />
        </div>

        {/* Tagline */}
        <p
          style={{
            fontFamily: fonts.primary,
            fontSize: "clamp(0.85rem, 1.5vw, 1rem)",
            fontWeight: 400,
            color: "rgba(245,241,232,0.4)",
            maxWidth: 380,
            margin: "0 auto 44px",
            lineHeight: 1.8,
            letterSpacing: "0.04em",
            opacity: loaded ? 1 : 0,
            transform: loaded ? "none" : "translateY(15px)",
            transition: "all 1s ease 1.4s",
          }}
        >
          La mejor gastronomia del mundo en tu mesa
        </p>

        {/* CTAs */}
        <div
          style={{
            display: "flex",
            gap: 14,
            justifyContent: "center",
            flexWrap: "wrap",
            opacity: loaded ? 1 : 0,
            transition: "opacity 1s ease 1.8s",
          }}
        >
          <Button dark href="/reservation">
            Reservar Mesa
          </Button>
          <Button href="/menu">Descubrir el Menú</Button>

        </div>
      </div >

      {/* Scroll cue */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: loaded ? 1 : 0,
          transition: "opacity 1s ease 2.2s",
          animation: "float 3s ease-in-out infinite",
        }
        }
      >
        <div
          style={{
            width: 1,
            height: 48,
            background: `linear-gradient(to bottom, transparent, rgba(186,132,60,0.5))`,
          }}
        />
      </div >
    </section >
  );
}
