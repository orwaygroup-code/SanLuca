"use client";

import { useEffect, useState } from "react";
import { C, Modal, btn, formatMXN } from "./ui";

export interface SplitBillItem { id: number; name: string; unitPrice: number; remainingQty: number }

/**
 * Modal de división de cuenta por UNIDAD (Fase B.2). De los platillos con cupo
 * restante en la matriz, el mesero elige cuántas unidades van en esta división:
 * checkbox si solo queda 1, stepper (0..disponibles) si quedan varias. Esto
 * permite repartir un mismo platillo entre comensales ("Pasta ×2" → uno cada quien).
 * No permite confirmar con 0 unidades. Lo no seleccionado permanece en la matriz.
 */
export function SplitBillModal({ open, divisionNumber, items, busy, onConfirm, onClose }: {
  open: boolean;
  divisionNumber: number;
  items: SplitBillItem[];
  busy?: boolean;
  onConfirm: (units: Map<number, number>) => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState<Record<number, number>>({});

  useEffect(() => { if (!open) setQty({}); }, [open]);

  const getQ = (id: number) => qty[id] ?? 0;
  const setClamped = (id: number, value: number, max: number) =>
    setQty((p) => ({ ...p, [id]: Math.max(0, Math.min(max, value)) }));

  const totalUnits = items.reduce((s, it) => s + getQ(it.id), 0);
  const selectedTotal = items.reduce((s, it) => s + it.unitPrice * getQ(it.id), 0);
  const canConfirm = totalUnits > 0 && !busy;

  const confirm = () => {
    const units = new Map<number, number>();
    for (const it of items) {
      const q = getQ(it.id);
      if (q > 0) units.set(it.id, q);
    }
    onConfirm(units);
  };

  return (
    <Modal open={open} title={`Dividir cuenta — División ${divisionNumber}`} onClose={onClose} width={480}>
      <p style={{ margin: "0 0 14px", color: C.dim, fontSize: "0.84rem", lineHeight: 1.5 }}>
        Elige cuántas unidades de cada platillo van en esta división. Lo que dejes sin asignar queda en la cuenta principal (matriz).
      </p>

      {items.length === 0 ? (
        <p style={{ color: C.faint, fontSize: "0.86rem", margin: "0 0 8px" }}>No quedan unidades sin asignar.</p>
      ) : (
        <div style={{ maxHeight: "46vh", overflowY: "auto", marginBottom: 14 }}>
          {items.map((it) => {
            const q = getQ(it.id);
            const on = q > 0;
            const single = it.remainingQty === 1;
            return (
              <div
                key={it.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 12px", borderRadius: 9, marginBottom: 8,
                  border: `1px solid ${on ? C.gold : C.line}`,
                  background: on ? "rgba(186,132,60,0.10)" : "transparent",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.cream, fontSize: "0.9rem", fontWeight: 600 }}>{it.name}</div>
                  <div style={{ color: C.faint, fontSize: "0.74rem", marginTop: 2 }}>
                    {formatMXN(it.unitPrice)} c/u{!single ? ` · ${q}/${it.remainingQty} disponibles` : ""}
                  </div>
                </div>

                {single ? (
                  <button
                    type="button"
                    onClick={() => setClamped(it.id, on ? 0 : 1, 1)}
                    aria-label={on ? "Quitar" : "Agregar"}
                    style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                      border: `1px solid ${on ? C.gold : C.dim}`, background: on ? C.gold : "transparent",
                      color: "#fff", fontSize: "0.82rem", lineHeight: "22px", textAlign: "center", fontWeight: 800,
                    }}
                  >{on ? "✓" : ""}</button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <button type="button" style={stepBtn(q > 0)} disabled={q === 0} onClick={() => setClamped(it.id, q - 1, it.remainingQty)}>−</button>
                    <span style={{ color: C.cream, fontWeight: 800, fontSize: "1.05rem", minWidth: 22, textAlign: "center" }}>{q}</span>
                    <button type="button" style={stepBtn(q < it.remainingQty)} disabled={q >= it.remainingQty} onClick={() => setClamped(it.id, q + 1, it.remainingQty)}>+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ color: C.dim, fontSize: "0.8rem" }}>{totalUnits} unidad{totalUnits === 1 ? "" : "es"}</span>
        <span style={{ color: C.gold, fontWeight: 800, fontSize: "0.95rem" }}>{formatMXN(selectedTotal)}</span>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
        <button
          style={{ ...btn.primary, opacity: canConfirm ? 1 : 0.5 }}
          onClick={confirm}
          disabled={!canConfirm}
        >
          Crear División {divisionNumber}
        </button>
      </div>
    </Modal>
  );
}

const stepBtn = (enabled: boolean): React.CSSProperties => ({
  width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.line}`,
  background: "transparent", color: enabled ? C.cream : C.faint,
  fontSize: "1.1rem", cursor: enabled ? "pointer" : "default", fontFamily: "inherit", lineHeight: 1,
});
