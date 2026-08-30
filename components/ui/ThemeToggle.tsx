"use client";

import { useEffect, useState } from "react";

/**
 * Conmutador de tema del SISTEMA (login, staff, caja, admin y CRM). No toca el
 * sitio público, que tiene su propia identidad por carta.
 *
 * El modo claro usa la paleta de la carta de brunch del sitio público —crema
 * #f0ebe0, azul profundo #1e3a52, acento #3d6b8c—, que es el positivo de la
 * identidad de San Luca. Las variables viven en styles/san-luca.css y las
 * paletas de JS apuntan a ellas, así que cambiar el atributo del documento
 * repinta el sistema entero sin volver a renderizar nada.
 *
 * La preferencia es por DISPOSITIVO, no por usuario: en el restaurante varias
 * personas comparten la misma tablet, y la pantalla de la caja necesita un
 * ajuste distinto al de un celular en el patio a mediodía.
 */

export const THEME_KEY = "sl_theme";
export type ThemeName = "dark" | "light";

/** Se ejecuta antes del primer pintado para que no haya destello de tema. */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});document.documentElement.setAttribute("data-sl-theme",t==="light"?"light":"dark");}catch(e){document.documentElement.setAttribute("data-sl-theme","dark");}})();`;

function apply(t: ThemeName) {
  document.documentElement.setAttribute("data-sl-theme", t);
  try { localStorage.setItem(THEME_KEY, t); } catch { /* almacenamiento no disponible */ }
}

export function ThemeToggle({ size = 40 }: { size?: number }) {
  const [theme, setTheme] = useState<ThemeName>("dark");

  useEffect(() => {
    const cur = document.documentElement.getAttribute("data-sl-theme");
    setTheme(cur === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next: ThemeName = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
  };

  const label = theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button
      onClick={toggle}
      title={label}
      aria-label={label}
      style={{
        width: size, height: size, display: "grid", placeItems: "center",
        borderRadius: 999, border: "1px solid var(--sl-border)",
        background: "transparent", color: "var(--sl-gold)",
        cursor: "pointer", fontFamily: "inherit", padding: 0, flexShrink: 0,
      }}
    >
      {/* Engranaje con un guiño al estado: sol en oscuro (lo que vas a
          obtener), luna en claro. El icono comunica el destino, no el estado
          actual — es lo que la persona espera al tocarlo. */}
      <svg
        width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
        )}
      </svg>
    </button>
  );
}
