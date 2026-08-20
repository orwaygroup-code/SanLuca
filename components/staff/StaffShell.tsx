"use client";

import React from "react";
import { C } from "./ui";
import { StaffRail, type RailActive, type OperTab } from "./StaffRail";

/**
 * Contenedor de las vistas de Perla: riel fijo a la izquierda + columna de
 * contenido. Una sola estructura para Operación / Reservas / Historial, para que
 * su identidad (y el uso del espacio) sea idéntica en las tres. `topBar` se
 * pinta dentro de la columna, antes del contenido (p. ej. la barra de turno).
 */
export function StaffShell({
  active, counts, onTab, onRefresh, onHelp, onLogout, userName, role, topBar, children, maxWidth = 1160, embedded = false,
}: {
  active: RailActive;
  counts?: { llegadas?: number; llevar?: number };
  onTab?: (t: OperTab) => void;
  onRefresh?: () => void;
  onHelp?: () => void;
  onLogout: () => void;
  userName?: string;
  role?: string;
  topBar?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number;
  /** Dentro del panel admin: sin riel ni alto de viewport (el admin ya da el shell/sidebar). */
  embedded?: boolean;
}) {
  const body = (
    <div style={embedded ? shell.mainEmbedded : shell.main}>
      {topBar}
      <div style={{ ...shell.content, maxWidth }}>{children}</div>
    </div>
  );
  if (embedded) return body;
  return (
    <div style={shell.root}>
      <StaffRail
        active={active}
        counts={counts}
        onTab={onTab}
        onRefresh={onRefresh}
        onHelp={onHelp}
        onLogout={onLogout}
        userName={userName}
        role={role}
      />
      {body}
    </div>
  );
}

const shell: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: C.bg, display: "grid", gridTemplateColumns: "112px 1fr", gridTemplateAreas: '"rail main"' },
  main: { gridArea: "main", minWidth: 0, display: "flex", flexDirection: "column" },
  mainEmbedded: { minWidth: 0, display: "flex", flexDirection: "column" },
  content: { width: "100%", margin: "0 auto", padding: "16px 22px 48px", boxSizing: "border-box" },
};
