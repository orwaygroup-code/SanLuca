"use client";

import { ExportModal } from "@/components/admin/ExportModal";
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
 * Exportación de Reportes de venta: sólo enlaza los generadores del reporte
 * con la ventana compartida.
 *
 * Se exporta la SUB-VISTA seleccionada —Resumen, Por producto, Por sección del
 * menú, Por zona o Por mesero— y no el reporte entero: volcar todo es material
 * de control de almacén para compaginar inventario con venta, no lo que se
 * consulta desde esta pantalla.
 */
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
  return (
    <ExportModal
      open={open}
      onClose={onClose}
      subtitle={`${SUB_LABEL[sub]} · ${rangeLabel}`}
      hasRows={!!data && subHasRows(data, sub)}
      emptyHint={`«${SUB_LABEL[sub]}» no tiene datos en este rango. Cambia de vista o de fechas.`}
      onDone={onDone}
      producers={{
        ticket: () => reportToTicketText(data!, rangeLabel, sub),
        csv: () => reportToCsv(data!, rangeLabel, sub),
        html: () => reportToPrintableHtml(data!, rangeLabel, sub),
        fileName: (ext) => reportFileName(rangeLabel, ext, sub),
      }}
    />
  );
}
