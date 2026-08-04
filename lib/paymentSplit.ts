// Reparto PURO de un cobro de caja (sin DB, client-safe). Fuente única de la
// matemática que usa el PayModal: cuánto de lo que entrega el cliente cubre la
// cuenta y qué pasa con el excedente.

export type PayMethod = "CASH" | "CARD_DEBIT" | "CARD_CREDIT" | "TRANSFER" | "WAITER_CREDIT";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface SplitLineInput { method: PayMethod; tendered: number; reference?: string }
export interface SplitLineCalc {
  method: PayMethod; tendered: number; reference: string;
  remainingBefore: number; // saldo antes de aplicar esta línea
  billPortion: number; // lo que esta línea abona a la cuenta = min(tendered, remainingBefore)
  excess: number; // tendered − billPortion
  change: number; // excedente devuelto (solo efectivo)
  tip: number; // excedente que se va como propina del mesero (solo tarjeta/transferencia)
}

/**
 * Reparte lo que el cliente entrega por método contra el saldo `remaining`.
 * Cada línea abona a la cuenta hasta lo que falta; el excedente es CAMBIO si es
 * efectivo (CASH) o PROPINA del mesero si es tarjeta/transferencia. El orden
 * importa: cada línea va restando el saldo para la siguiente.
 */
export function splitPaymentLines(lines: SplitLineInput[], remaining: number): SplitLineCalc[] {
  let rem = remaining;
  return lines.map((l) => {
    const tendered = round2(l.tendered);
    const remainingBefore = round2(Math.max(0, rem));
    const billPortion = round2(Math.min(tendered, remainingBefore));
    const excess = round2(Math.max(0, tendered - billPortion));
    const isCash = l.method === "CASH";
    rem = round2(rem - billPortion);
    return {
      method: l.method, tendered, reference: l.reference ?? "",
      remainingBefore, billPortion, excess,
      change: isCash ? excess : 0,
      tip: isCash ? 0 : excess,
    };
  });
}
