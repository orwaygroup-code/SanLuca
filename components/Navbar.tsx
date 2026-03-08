"use client";

import { useState, useEffect } from "react";
import { colors, fonts } from "@/config/theme";

const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Menú", href: "/menu" },
  { label: "Sobre Nosotros", href: "#about" },
  { label: "Reservaciones", href: "#reservaciones" },
  { label: "Contacto", href: "/contact" },
];

function NavLink({ label, href }: { label: string; href: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: fonts.primary,
        fontSize: "0.72rem",
        fontWeight: 800,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: hovered ? colors.peru : "rgba(245,241,232,0.75)",
        textDecoration: "none",
        transition: "color 0.3s",
        position: "relative",
        paddingBottom: 4,
      }}
    >
      {label}
      <span
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: hovered ? "100%" : 0,
          height: 1.5,
          background: colors.peru,
          transition: "width 0.3s",
        }}
      />
    </a>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: scrolled ? colors.dark : "rgba(28,38,40,0.55)",
        backdropFilter: "blur(14px)",
        transition: "all 0.5s",
        borderBottom: scrolled
          ? "1px solid rgba(186,132,60,0.12)"
          : "none",
        padding: scrolled ? "8px 0" : "16px 0",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <a
          href="/"
          style={{
            fontFamily: fonts.primary,
            fontWeight: 800,
            fontSize: "1rem",
            color: colors.peru,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            lineHeight: 0.9,
            textDecoration: "none",
          }}
        >
          <span>SAN</span>
          <br />
          <span>LUCA</span>
        </a>

        {/* Desktop Nav */}
        <div className="nav-desk" style={{ display: "flex", gap: 32 }}>
          {NAV_LINKS.map((l) => (
            <NavLink key={l.label} {...l} />
          ))}
        </div>

        {/* Mobile Toggle */}
        <button
          className="nav-mob"
          onClick={() => setOpen(!open)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 8,
            display: "none",
          }}
          aria-label="Abrir menú"
        >
          <div
            style={{
              width: 22,
              height: 2,
              background: colors.cream,
              marginBottom: 5,
              transition: "0.3s",
              transform: open
                ? "rotate(45deg) translate(5px,5px)"
                : "none",
            }}
          />
          <div
            style={{
              width: 22,
              height: 2,
              background: colors.cream,
              marginBottom: 5,
              opacity: open ? 0 : 1,
              transition: "0.3s",
            }}
          />
          <div
            style={{
              width: open ? 22 : 16,
              height: 2,
              background: colors.peru,
              transition: "0.3s",
              transform: open
                ? "rotate(-45deg) translate(5px,-5px)"
                : "none",
            }}
          />
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div
          className="nav-mob-menu"
          style={{
            background: colors.dark,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            alignItems: "center",
            borderTop: "1px solid rgba(186,132,60,0.1)",
          }}
        >
          {NAV_LINKS.map((l) => (
            <NavLink key={l.label} {...l} />
          ))}
        </div>
      )}
    </nav>
  );
}
