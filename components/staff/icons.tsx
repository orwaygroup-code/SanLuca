"use client";

import React from "react";

/**
 * Set de íconos de línea (stroke) para las vistas de Staff. SVG inline, sin
 * dependencia externa: heredan el color vía `currentColor` (dorado/crema según
 * el contenedor) y comparten grosor/terminaciones para verse como una familia.
 * Reemplazan a los emojis (que renderizaban distinto por SO y rompían la estética).
 */

const GLYPH: Record<string, React.ReactNode> = {
  // navegación
  plate: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.6" /></>,
  arrive: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></>,
  bag: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  history: <><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></>,
  pulse: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  coins: <><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" /></>,
  // acciones
  refresh: <><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M21 21v-5h-5" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  printer: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>,
  chevron: <polyline points="9 18 15 12 9 6" />,
  help: <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  scissors: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  alert: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  // #7 Panel 101: el número "101" dentro de una pastilla.
  n101: <><rect x="1.5" y="6" width="21" height="12" rx="3.5" /><text x="12" y="15.4" textAnchor="middle" fontSize={8.6} fontWeight={800} fill="currentColor" stroke="none" fontFamily="system-ui, sans-serif">101</text></>,
  // Panel 86 + 101 en un solo glifo, partido por la mitad: a la izquierda el
  // producto agotado (86, tachado); a la derecha el producto insignia (101,
  // estrella). Un único botón abre el panel, que ya trae su propio conmutador
  // entre ambas secciones.
  faltantes101: <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3.1v17.8" opacity="0.55" />
    <path d="m6.7 8.7 4.1 6.3" />
    <path d="m16.6 8.7 1 2.02 2.22.33-1.61 1.56.38 2.21-1.99-1.05-1.99 1.05.38-2.21-1.61-1.56 2.22-.33z" />
  </>,
};

export type IconName = keyof typeof GLYPH;

export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {GLYPH[name]}
    </svg>
  );
}
