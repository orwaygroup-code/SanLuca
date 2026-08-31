"use client";

import { useState } from "react";
import { apiFetch } from "@/components/staff/types";
import { RP } from "@/components/admin/reportsUi";

/**
 * Ventana de exportación compartida por Reportes de venta, Historial de venta
 * y Cierres de turno.
 *
 * No sabe nada del contenido: recibe tres generadores de texto y un nombre
 * base de archivo. Así las tres pantallas ofrecen exactamente las mismas
 * opciones y se comportan igual, sin repetir la ventana ni la plomería de
 * descarga e impresión.
 *
 *  - Caja: encola un ticket de 42 columnas en la impresora térmica.
 *  - Hoja de cálculo: CSV, sin dependencias; abre en Excel y en Sheets.
 *  - PDF: documento imprimible + diálogo del navegador ("Guardar como PDF").
 *    Se prefirió a sumar una librería de PDF al bundle: el sistema operativo
 *    ya lo resuelve y respeta el tamaño de papel de quien imprime.
 */

type Kind = "caja" | "hoja" | "pdf";

const OPCIONES: { kind: Kind; title: string; desc: string; icon: string; download: string }[] = [
  { kind: "caja", title: "Imprimir en caja", desc: "Sale por la impresora de la caja, en formato ticket.", icon: "🖶", download: "el ticket (.txt)" },
  { kind: "hoja", title: "Crear hoja de cálculo", desc: "Archivo CSV de esta vista. Abre en Excel o Sheets.", icon: "▦", download: "la hoja (.csv)" },
  { kind: "pdf", title: "PDF", desc: "Abre el documento y elige «Guardar como PDF» al imprimir.", icon: "⎙", download: "el documento (.html)" },
];

/** Descarga un texto como archivo, sin pasar por el servidor. */
function download(content: string, filename: string, mime: string) {
  // BOM: sin él, Excel abre el CSV en ANSI y rompe los acentos.
  const blob = new Blob([mime.startsWith("text/csv") ? "﻿" + content : content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Se libera después del clic: revocarla en el mismo tick cancela la descarga
  // en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface ExportProducers {
  /** Texto del ticket de 42 columnas. */
  ticket: () => string;
  /** Contenido del CSV. */
  csv: () => string;
  /** Documento HTML imprimible. */
  html: () => string;
  /** Nombre del archivo, sin extensión decidida por el formato. */
  fileName: (ext: string) => string;
}

export function ExportModal({
  open, onClose, subtitle, hasRows, emptyHint, producers, onDone,
}: {
  open: boolean;
  onClose: () => void;
  /** Qué se va a exportar: vista y rango. */
  subtitle: string;
  hasRows: boolean;
  emptyHint?: string;
  producers: ExportProducers;
  onDone?: (msg: string, kind: "success" | "error") => void;
}) {
  const [busy, setBusy] = useState<Kind | null>(null);

  if (!open) return null;

  /**
   * Descarga directa del archivo de ese formato, sin pasar por el diálogo de
   * impresión. Es la mitad derecha de cada recuadro: la izquierda hace lo suyo
   * —mandar a la impresora, abrir el diálogo— y el icono se queda con el
   * archivo, que muchas veces es lo único que se quiere.
   */
  const descargar = (kind: Kind) => {
    if (kind === "hoja") {
      download(producers.csv(), producers.fileName("csv"), "text/csv;charset=utf-8");
      onDone?.("Hoja de cálculo descargada", "success");
    } else if (kind === "pdf") {
      // Documento imprimible. El PDF de verdad lo produce el diálogo del
      // sistema; aquí se entrega el archivo tal cual, que se abre en cualquier
      // navegador y de ahí se guarda como PDF sin depender de esta ventana.
      download(producers.html(), producers.fileName("html"), "text/html;charset=utf-8");
      onDone?.("Documento descargado", "success");
    } else {
      // El mismo texto de 42 columnas que sale por la térmica, en un archivo.
      download(producers.ticket(), producers.fileName("txt"), "text/plain;charset=utf-8");
      onDone?.("Ticket descargado", "success");
    }
    onClose();
  };

  const run = async (kind: Kind) => {
    setBusy(kind);
    try {
      if (kind === "hoja") {
        download(producers.csv(), producers.fileName("csv"), "text/csv;charset=utf-8");
        onDone?.("Hoja de cálculo descargada", "success");
        onClose();
      } else if (kind === "pdf") {
        const w = window.open("", "_blank");
        if (!w) {
          // Bloqueador de ventanas emergentes: no se puede abrir el diálogo.
          onDone?.("El navegador bloqueó la ventana. Permite las ventanas emergentes de este sitio.", "error");
          return;
        }
        w.document.write(producers.html());
        w.document.close();
        // Se espera a que carguen tipografías y estilos; imprimir antes saca
        // una hoja a medio formatear.
        w.onload = () => { w.focus(); w.print(); };
        onClose();
      } else {
        const r = await apiFetch<{ id: number }>("/api/admin/reports/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: producers.ticket() }),
        });
        if (r.ok) { onDone?.("Enviado a la impresora de caja", "success"); onClose(); }
        else onDone?.(r.error ?? "No se pudo enviar a la impresora", "error");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Exportar"
        style={{ width: "min(460px, 100%)", background: RP.panel, border: `1px solid ${RP.border}`, borderRadius: 14, padding: 20, boxShadow: "0 18px 60px rgba(0,0,0,0.55)" }}
      >
        <div style={{ fontSize: "1rem", fontWeight: 800, color: RP.cream }}>Exportar</div>
        {/* Se nombra qué va a salir: se exporta lo que está en pantalla, con
            sus filtros aplicados. */}
        <div style={{ fontSize: "0.8rem", color: RP.dim, marginTop: 4, marginBottom: 16 }}>{subtitle}</div>

        {!hasRows ? (
          <div style={{ color: RP.dim, fontSize: "0.86rem" }}>
            {emptyHint ?? "No hay datos que exportar con estos filtros."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Cada opción son DOS acciones en un mismo recuadro: el cuerpo hace lo
                suyo —mandar a la térmica, abrir el diálogo— y el icono de la
                derecha se queda con el archivo. Van como botones hermanos y no
                anidados: un botón dentro de otro no es HTML válido y el clic
                interior dispararía también el exterior. */}
            {OPCIONES.map((o) => (
              <div
                key={o.kind}
                style={{
                  display: "flex", alignItems: "stretch", width: "100%",
                  borderRadius: 11, overflow: "hidden",
                  border: `1px solid ${RP.border}`, background: "rgba(0,0,0,0.18)",
                  opacity: busy && busy !== o.kind ? 0.5 : 1,
                }}
              >
                <button
                  onClick={() => run(o.kind)}
                  disabled={busy !== null}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, textAlign: "left", flex: 1, minWidth: 0,
                    padding: "13px 14px", cursor: busy ? "default" : "pointer",
                    border: "none", background: "transparent", color: RP.cream, fontFamily: "inherit",
                  }}
                >
                  <span aria-hidden style={{ fontSize: "1.15rem", color: RP.gold, width: 22, textAlign: "center", flexShrink: 0 }}>{o.icon}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 700, fontSize: "0.9rem" }}>
                      {busy === o.kind ? "Preparando…" : o.title}
                    </span>
                    <span style={{ display: "block", color: RP.dim, fontSize: "0.76rem", marginTop: 2 }}>{o.desc}</span>
                  </span>
                </button>
                <button
                  onClick={() => descargar(o.kind)}
                  disabled={busy !== null}
                  title={`Descargar ${o.download}`}
                  aria-label={`Descargar ${o.download}`}
                  style={{
                    flexShrink: 0, width: 52, display: "grid", placeItems: "center",
                    cursor: busy ? "default" : "pointer", fontFamily: "inherit",
                    border: "none", borderLeft: `1px solid ${RP.border}`,
                    background: "transparent", color: RP.gold,
                  }}
                >
                  {/* SVG y no emoji: el emoji lo dibuja cada sistema con su propia
                      tipografía y rompe la alineación de la fila. */}
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="M7 10l5 5 5-5" />
                    <path d="M12 15V3" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          disabled={busy !== null}
          style={{ marginTop: 16, width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${RP.border}`, background: "transparent", color: RP.dim, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: "0.85rem" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Botón estándar para abrir la exportación, igual en las tres pantallas. */
export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "No hay datos que exportar" : "Exportar lo que estás viendo"}
      style={{
        padding: "9px 16px", borderRadius: 9, cursor: disabled ? "default" : "pointer",
        fontWeight: 700, fontSize: "0.83rem", fontFamily: "inherit",
        border: `1px solid ${RP.gold}`, background: "transparent", color: RP.gold,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      Exportar
    </button>
  );
}
