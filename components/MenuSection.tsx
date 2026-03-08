"use client";

import { useState } from "react";
import { colors, fonts } from "@/config/theme";
import { SectionHead } from "@/components/ui/SectionHead";

const MENU_DATA: Record<string, { name: string; desc: string; price: string }[]> = {
  antipasti: [
    { name: "Bruschetta al Pomodoro", desc: "Pan artesanal, tomate San Marzano, albahaca fresca, aceite extra virgen", price: "$145" },
    { name: "Carpaccio di Manzo", desc: "Láminas de res premium, rúcula, parmesano reggiano, balsámico", price: "$195" },
    { name: "Burrata con Prosciutto", desc: "Burrata cremosa, jamón de Parma 24 meses, higos confitados", price: "$225" },
  ],
  pasta: [
    { name: "Tagliatelle al Ragù", desc: "Pasta fresca al huevo, ragú boloñés cocido 6 horas", price: "$245" },
    { name: "Risotto ai Funghi Porcini", desc: "Arroz carnaroli, porcini importados, mantequilla, parmesano", price: "$265" },
    { name: "Pappardelle al Tartufo", desc: "Pasta ancha artesanal, crema de trufa negra, pecorino romano", price: "$325" },
  ],
  secondi: [
    { name: "Ossobuco alla Milanese", desc: "Chamorro braseado, gremolata, risotto alla milanese", price: "$385" },
    { name: "Branzino al Forno", desc: "Lubina mediterránea, hierbas italianas, limón de Amalfi", price: "$345" },
    { name: "Filetto di Manzo", desc: "Filete premium, salsa al vino Barolo, verduras de estación", price: "$425" },
  ],
};

const TABS = [
  { key: "antipasti", label: "Antipasti" },
  { key: "pasta", label: "Pasta & Risotto" },
  { key: "secondi", label: "Secondi" },
];

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: fonts.primary,
        fontSize: "0.72rem",
        fontWeight: 800,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        padding: "11px 26px",
        background: active ? colors.peru : "transparent",
        color: active ? colors.white : hovered ? colors.peru : "rgba(245,241,232,0.4)",
        border: `1.5px solid ${active ? colors.peru : hovered ? "rgba(186,132,60,0.3)" : "rgba(245,241,232,0.1)"}`,
        cursor: "pointer",
        transition: "all 0.3s",
      }}
    >
      {label}
    </button>
  );
}

function MenuItem({ name, desc, price }: { name: string; desc: string; price: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "26px 0",
        borderBottom: "1px solid rgba(186,132,60,0.08)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 20,
        transition: "opacity 0.3s",
        opacity: hovered ? 1 : 0.8,
      }}
    >
      <div style={{ flex: 1 }}>
        <h4
          style={{
            fontFamily: fonts.primary,
            fontSize: "1.15rem",
            fontWeight: 800,
            color: colors.cream,
            margin: "0 0 5px",
            letterSpacing: "0.04em",
          }}
        >
          {name}
        </h4>
        <p
          style={{
            fontFamily: fonts.primary,
            fontSize: "0.9rem",
            fontWeight: 400,
            color: "rgba(245,241,232,0.38)",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {desc}
        </p>
      </div>
      <span
        style={{
          fontFamily: fonts.primary,
          fontSize: "1.1rem",
          fontWeight: 800,
          color: colors.peru,
          whiteSpace: "nowrap",
        }}
      >
        {price}
      </span>
    </div>
  );
}

export default function MenuSection() {
  const [tab, setTab] = useState("antipasti");

  return (
    <section
      style={{
        background: colors.dark,
        padding: "clamp(64px, 10vw, 120px) 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='t'%3E%3CfeTurbulence baseFrequency='0.85' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23t)'/%3E%3C/svg%3E")`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "-12%",
          right: "-8%",
          width: 550,
          height: 550,
          borderRadius: "50%",
          border: "1px solid rgba(186,132,60,0.04)",
        }}
      />

      <div style={{ maxWidth: 850, margin: "0 auto", position: "relative" }}>
        <SectionHead
          script="Il nostro menù"
          title="Sabores de Italia"
          desc="Cada plato es una obra de arte culinaria, preparado con técnicas tradicionales y los ingredientes más selectos."
          light
        />

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            marginBottom: 44,
            flexWrap: "wrap",
          }}
        >
          {TABS.map((t) => (
            <TabButton
              key={t.key}
              active={tab === t.key}
              onClick={() => setTab(t.key)}
              label={t.label}
            />
          ))}
        </div>

        <div>
          {MENU_DATA[tab].map((item) => (
            <MenuItem key={item.name} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}
