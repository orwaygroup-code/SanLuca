// ─────────────────────────────────────────────
//  app/menu/page.tsx
//  Hero (PDF p.1) + PILLARS sin modificar
// ─────────────────────────────────────────────

import type { Metadata } from "next";
import Reveal from "@/components/ui/Reveal";
import { Texture } from "@/components/ui/Editorial";
import { fonts, colors } from "@/config/theme";
import { Label } from "@/components/ui/Editorial";
import MenuHero from "@/components/menu/MenuHero";

export const metadata: Metadata = {
    title: "Origin | San Luca",
    description: "El Origen de la Experiencia",
};

// ── PILLARS — sin modificar ──────────────────
const PILLARS = [
    {
        title: "Aguas de Nueva Zelanda",
        desc: "Salmón Ora King: Textura sedosa y sabor profundo",
    },
    {
        title: "Ensenada, B.C., México",
        desc: "Totoaba, Lubina, Calamares, Almejas & Mejillones, ",
    },
    {
        title: "Océano Atlántico,",
        desc: "Atún Aleta Azul: Corte selecto y jugoso; su grasa natural aporta untuosidad y sabor",
    },
    {
        title: "Atlántico Oriental y Mediterráneo",
        desc: "Pulpo Vulgaris: Carne tierna y jugosa con un sutil toque salino",
    },
];

export default function Origin() {
    return (
        <>

            {/* ── PILLARS (sin modificar) ─────────── */}
            <section
                style={{
                    padding: "5rem 2rem",
                    maxWidth: "1400px",
                    margin: "0 auto",
                }}
            >
                <Reveal delay={0.1}>
                    <Label>La Casa</Label>

                    <h2
                        style={{
                            fontFamily: fonts.primary,
                            fontSize: "clamp(1.6rem,2.5vw,2rem)",
                            fontWeight: 300,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "rgba(28,38,40,0.6)",
                            marginTop: "10px",
                        }}
                    >
                        El Origen{" "}
                        <span style={{ color: colors.peru }}>de la Excelencia</span>
                    </h2>
                </Reveal>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns:
                            "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
                        gap: 0,
                        marginTop: "clamp(48px,6vw,80px)",
                        borderTop: "1px solid rgba(28,38,40,0.08)",
                    }}
                >
                    {PILLARS.map((p, i) => (
                        <Reveal
                            key={p.title}
                            delay={i * 0.1}
                            style={{
                                padding: "clamp(28px,3vw,44px) clamp(20px,2vw,32px)",
                                borderBottom: "1px solid rgba(28,38,40,0.08)",
                                borderRight: "1px solid rgba(28,38,40,0.08)",
                            }}
                        >
                            <div
                                style={{
                                    fontFamily: fonts.primary,
                                    fontSize: "3rem",
                                    fontWeight: 800,
                                    color: "rgba(186,132,60,0.1)",
                                    lineHeight: 1,
                                    marginBottom: 16,
                                }}
                            />

                            <h4
                                style={{
                                    fontFamily: fonts.primary,
                                    fontSize: "1.05rem",
                                    fontWeight: 800,
                                    color: colors.dark,
                                    letterSpacing: "0.04em",
                                    margin: "0 0 8px",
                                }}
                            >
                                {p.title}
                            </h4>

                            <p
                                style={{
                                    fontFamily: fonts.primary,
                                    fontSize: "0.9rem",
                                    fontWeight: 400,
                                    color: "rgba(28,38,40,0.45)",
                                    lineHeight: 1.7,
                                    margin: 0,
                                }}
                            >
                                {p.desc}
                            </p>
                        </Reveal>
                    ))}
                </div>

                {/* Mapa */}
                <div
                    style={{
                        position: "relative",
                        width: "70%",
                        margin: "3rem auto 0",
                        borderRadius: "8px",
                        overflow: "hidden",
                    }}
                >
                    <img
                        src="/images/mapamundi.png"
                        alt="Mapa de orígenes San Luca"
                        style={{
                            width: "100%",
                            height: "auto",
                            display: "block",
                            opacity: 0.65,
                            mixBlendMode: "multiply",
                        }}
                    />
                </div>
            </section>

            <Texture dark={false} />
        </>
    );
}