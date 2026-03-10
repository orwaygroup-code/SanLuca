"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { colors, fonts } from "@/config/theme";

const NAV_LINKS = [
  { label: "Filosofía", href: "#filosofia" },
  { label: "Menú", href: "/menu" },

  { label: "Historia", href: "#historia" },
  { label: "Reservar", href: "/reservation" },
  { label: "Contacto", href: "/contact" },
];

function NavLink({
  label,
  href,
  onClick,
}: {
  label: string;
  href: string;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: fonts.primary,
        fontSize: "0.62rem",
        fontWeight: 800,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color: hovered ? colors.peru : "rgba(245,241,232,0.6)",
        textDecoration: "none",
        transition: "color 0.3s",
      }}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const [show, setShow] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const handler = () => {
      const y = window.scrollY;
      setShow(y < 100 || y < lastY.current);
      setScrolled(y > 80);
      lastY.current = y;
    };

    window.addEventListener("scroll", handler, { passive: true });
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
        transform: show ? "translateY(0)" : "translateY(-100%)",
        background: scrolled ? "rgba(28,38,40,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        transition: "all 0.5s cubic-bezier(.25,.46,.45,.94)",
        padding: scrolled ? "12px 0" : "24px 0",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 clamp(20px,4vw,48px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            fontFamily: fonts.primary,
            fontWeight: 500,
            fontSize: "0.85rem",
            color: colors.cream,
            textDecoration: "none",
          }}
        >
          SAN
          <br />
          LUCA
        </Link>

        {/* Desktop */}
        <div
          className="nav-desktop"
          style={{
            display: "flex",
            gap: "clamp(20px,2.5vw,36px)",
            alignItems: "center",
          }}
        >
          {NAV_LINKS.map((l) => (
            <NavLink key={l.label} {...l} />
          ))}
        </div>

        {/* Mobile toggle */}
        <button
          className="nav-mobile-btn"
          onClick={() => setOpen(!open)}
          style={{
            display: "none",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 6,
          }}
          aria-label="Menú"
        >
          <svg width="24" height="14" viewBox="0 0 24 14" fill="none">
            <line
              x1="0"
              y1="1"
              x2="24"
              y2="1"
              stroke={colors.cream}
              strokeWidth="1.5"
              style={{
                transition: "0.3s",
                transform: open
                  ? "rotate(45deg) translate(4px,4px)"
                  : "none",
                transformOrigin: "center",
              }}
            />
            <line
              x1="0"
              y1="7"
              x2="24"
              y2="7"
              stroke={colors.peru}
              strokeWidth="1.5"
              style={{
                transition: "0.3s",
                opacity: open ? 0 : 1,
              }}
            />
            <line
              x1="6"
              y1="13"
              x2="24"
              y2="13"
              stroke={colors.cream}
              strokeWidth="1.5"
              style={{
                transition: "0.3s",
                transform: open
                  ? "rotate(-45deg) translate(4px,-4px)"
                  : "none",
                transformOrigin: "center",
              }}
            />
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="nav-mobile-menu"
          style={{
            background: "rgba(28,38,40,0.98)",
            padding: "32px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
            alignItems: "center",
          }}
        >
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.label}
              {...l}
              onClick={() => setOpen(false)}
            />
          ))}
        </div>
      )}
    </nav>
  );
}