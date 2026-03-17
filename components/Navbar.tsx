"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  isDark,
}: {
  label: string;
  href: string;
  onClick?: () => void;
  isDark: boolean;
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
        color: hovered ? colors.peru : isDark ? "rgba(245,241,232,0.6)" : "rgba(30,58,82,0.7)",
        textDecoration: "none",
        transition: "color 0.3s",
      }}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const router = useRouter();
  const [show, setShow] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    const check = () => {
      setIsDark(document.body.dataset.navTheme !== "brunch");
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-nav-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const syncAuth = () => setUserName(localStorage.getItem("userName"));
    syncAuth();
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

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

  const handleLogout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    setUserName(null);
    router.push("/");
  };

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        transform: show ? "translateY(0)" : "translateY(-100%)",
        background: scrolled
          ? isDark ? "rgba(28,38,40,0.92)" : "rgba(240,235,224,0.95)"
          : "transparent",
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
            color: isDark ? colors.cream : "#1e3a52",
            textDecoration: "none",
            transition: "color 0.4s ease",
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
            <NavLink key={l.label} {...l} isDark={isDark} />
          ))}

          {/* Auth section */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: 8 }}>
            {userName ? (
              <>
                <span style={{
                  fontFamily: fonts.primary,
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: colors.peru,
                }}>
                  Hola, {userName.split(" ")[0]}
                </span>
                <Link href="/dashboard" style={{
                  fontFamily: fonts.primary,
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: colors.cream,
                  textDecoration: "none",
                  border: `1px solid ${colors.peru}`,
                  borderRadius: 999,
                  padding: "6px 14px",
                  transition: "all 0.2s",
                }}>
                  Mis Reservas
                </Link>
                <button onClick={handleLogout} style={{
                  fontFamily: fonts.primary,
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: isDark ? "rgba(245,241,232,0.4)" : "rgba(30,58,82,0.4)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "color 0.2s",
                }}>
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link href="/login?mode=login" style={{
                  fontFamily: fonts.primary,
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: isDark ? "rgba(245,241,232,0.6)" : "rgba(30,58,82,0.7)",
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}>
                  Iniciar Sesión
                </Link>
                <Link href="/login?mode=register" style={{
                  fontFamily: fonts.primary,
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: isDark ? "rgba(245,241,232,0.6)" : "#ffffff",
                  textDecoration: "none",
                  background: isDark ? colors.peru : "rgba(30, 58, 82, 0.7)",
                  borderRadius: 999,
                  padding: "6px 14px",
                  transition: "background 0.2s",
                }}>
                  Registrar
                </Link>
              </>
            )}
          </div>
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
              stroke={isDark ? colors.cream : "#1e3a52"}
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
              stroke={isDark ? colors.cream : "#1e3a52"}
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
      {
        open && (
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
              <NavLink key={l.label} {...l} isDark={isDark} onClick={() => setOpen(false)} />
            ))}

            <div style={{ width: "100%", height: 1, background: "rgba(186,132,60,0.2)" }} />

            {userName ? (
              <>
                <span style={{
                  fontFamily: fonts.primary, fontSize: "0.65rem",
                  fontWeight: 800, textTransform: "uppercase", color: colors.peru,
                }}>
                  Hola, {userName.split(" ")[0]}
                </span>
                <NavLink label="Mis Reservas" href="/dashboard" isDark={isDark} onClick={() => setOpen(false)} />
                <button onClick={() => { handleLogout(); setOpen(false); }} style={{
                  fontFamily: fonts.primary, fontSize: "0.62rem", fontWeight: 800,
                  textTransform: "uppercase", color: "rgba(245,241,232,0.4)",
                  background: "none", border: "none", cursor: "pointer",
                }}>
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <>
                <NavLink label="Iniciar Sesión" href="/login?mode=login" isDark={isDark} onClick={() => setOpen(false)} />
                <NavLink label="Registrar" href="/login?mode=register" isDark={isDark} onClick={() => setOpen(false)} />
              </>
            )}
          </div>
        )
      }
    </nav >
  );
}