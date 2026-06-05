/**
 * Cómo MOSTRAR los totales de una comanda en la UI (Fase B.2). El total
 * siempre viene del backend; aquí solo se decide el desglose según el toggle
 * de IVA: con IVA activo se muestra Subtotal + IVA + Total; sin IVA, solo Total.
 */

export interface ComandaMoney {
  subtotal: number | string;
  taxAmount: number | string;
  total: number | string;
}

export interface TotalLine { label: string; amount: number; strong?: boolean }

export function buildTotalLines(money: ComandaMoney, taxEnabled: boolean): TotalLine[] {
  const total = Number(money.total);
  if (!taxEnabled) {
    return [{ label: "Total", amount: total, strong: true }];
  }
  return [
    { label: "Subtotal", amount: Number(money.subtotal) },
    { label: "IVA", amount: Number(money.taxAmount) },
    { label: "Total", amount: total, strong: true },
  ];
}

export function formatMXN(n: number): string {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
}
