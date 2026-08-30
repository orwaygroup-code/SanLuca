"use client";

import { useState } from "react";
import { apiFetch } from "@/components/staff/types";
import { RP } from "@/components/admin/reportsUi";
import {
  reportToTicketText,
  reportToCsv,
  reportToPrintableHtml,
  reportFileName,
  subHasRows,
  SUB_LABEL,
  type ReportData,
  type ReportSub,
} from "@/lib/reportExport";

/**
 * Exportar el reporte de ventas en los tres formatos que se usan en el
 * restaurante. Se exporta la SUB-VISTA seleccionada —Resumen, Por producto,
 * Por sección del menú o Por zona— y no el reporte entero: volcar todo es
 * material de control de almacén para compaginar inventario con venta, no lo
 * que se consulta desde esta pantalla.
 *
 *  - Caja: encola un ticket de 42 columnas en la impresora térmica.
 *  - Hoja de cálculo: CSV, sin dependencias y abre en Excel y en Sheets.
 *  - PDF: documento imprimible + diálogo del navegador ("Guardar como PDF").
 *    Se prefirió a sumar una librería de PDF al bundle: el sistema operativo
 *    ya lo resuelve y respeta el tamaño de papel de quien imprime.
 */

type Kind = "caja" | "hoja" | "pdf";

const OPCIONES: { kind: Kind; title: string; desc: string; icon: string }[] = [
  { kind: "caja", title: "Imprimir en caja", desc: "Sale por la impresora de la caja, en formato ticket.", icon: "🖶" },
  { kind: "hoja", title: "Crear hoja de cálculo", desc: "Archivo CSV de esta vista. Abre en Excel o Sheets.", icon: "▦" },
  { kind: "pdf", title: "PDF", desc: "Abre el documento y elige «Guardar como PDF» al imprimir.", icon: "⎙" },
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

export function ExportReportModal({
  open, onClose, data, rangeLabel, sub, onDone,
}: {
  open: boolean;
  onClose: () => void;
  data: ReportData | null;
  rangeLabel: string;
  sub: ReportSub;
  onDone?: (msg: string, kind: "success" | "error") => void;
}) {
  const [busy, setBusy] = useState<Kind | null>(null);

  if (!open) return null;

  const run = async (kind: Kind) => {
    if (!data) return;
    setBusy(kind);
    try {
      if (kind === "hoja") {
        download(reportToCsv(data, rangeLabel, sub), reportFileName(rangeLabel, "csv", sub), "text/csv;charset=utf-8");
        onDone?.("Hoja de cálculo descargada", "success");
        onClose();
      } else if (kind === "pdf") {
        const w = window.open("", "_blank");
        if (!w) {
          // Bloqueador de ventanas emergentes: no se puede abrir el diálogo.
          onDone?.("El navegador bloqueó la ventana. Permite las ventanas emergentes de este sitio.", "error");
          return;
        }
        w.document.write(reportToPrintableHtml(data, rangeLabel, sub));
        w.document.close();
        // Se espera a que cargue tipografías y estilos; imprimir antes saca
        // una hoja a medio formatear.
        w.onload = () => { w.focus(); w.print(); };
        onClose();
      } else {
        const r = await apiFetch<{ id: number }>("/api/admin/reports/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: reportToTicketText(data, rangeLabel, sub) }),
        });
        if (r.ok) { onDone?.("Reporte enviado a la impresora de caja", "success"); onClose(); }
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
        aria-label="Exportar reporte"
        style={{ width: "min(460px, 100%)", background: RP.panel, border: `1px solid ${RP.border}`, borderRadius: 14, padding: 20, boxShadow: "0 18px 60px rgba(0,0,0,0.55)" }}
      >
        <div style={{ fontSize: "1rem", fontWeight: 800, color: RP.cream }}>Exportar reporte</div>
        {/* Se nombra la vista, no sólo el rango: se exporta lo que está en
            pantalla, así que conviene que quede claro qué va a salir. */}
        <div style={{ fontSize: "0.8rem", color: RP.dim, marginTop: 4, marginBottom: 16 }}>
          {SUB_LABEL[sub]} · {rangeLabel}
        </div>

        {!data || !subHasRows(data, sub) ? (
          <div style={{ color: RP.dim, fontSize: "0.86rem" }}>
            «{SUB_LABEL[sub]}» no tiene datos en este rango. Cambia de vista o de fechas.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {OPCIONES.map((o) => (
              <button
                key={o.kind}
                onClick={() => run(o.kind)}
                disabled={busy !== null}
                style={{
                  display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%",
                  padding: "13px 14px", borderRadius: 11, cursor: busy ? "default" : "pointer",
                  border: `1px solid ${RP.border}`, background: "rgba(0,0,0,0.18)", color: RP.cream,
                  fontFamily: "inherit", opacity: busy && busy !== o.kind ? 0.5 : 1,
                }}
              >
                <span aria-hidden style={{ fontSize: "1.15rem", color: RP.gold, width: 22, textAlign: "center" }}>{o.icon}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: "0.9rem" }}>
                    {busy === o.kind ? "Preparando…" : o.title}
                  </span>
                  <span style={{ display: "block", color: RP.dim, fontSize: "0.76rem", marginTop: 2 }}>{o.desc}</span>
                </span>
              </button>
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
