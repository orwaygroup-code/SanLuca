/**
 * Resolución de mesas al EDITAR una reserva (Fase A — fix editor).
 *
 * Regla: editar una reserva NO debe mover su mesa. La mesa solo cambia desde
 * el flujo dedicado "Cambiar Mesa" (acción `move-table`). Por eso:
 *   - Si el body de edición NO trae `tableId` → se PRESERVA la asignación
 *     actual completa (mesa principal + combinadas).
 *   - Si el body trae `tableId` explícito → se usa esa selección.
 *
 * Nunca auto-asigna: la auto-asignación queda exclusiva del CREATE.
 */

export interface TableQuad {
  tableId:       string | null;
  linkedTableId: string | null;
  thirdTableId:  string | null;
  fourthTableId: string | null;
}

export type TableQuadInput = Partial<{
  tableId:       string | null;
  linkedTableId: string | null;
  thirdTableId:  string | null;
  fourthTableId: string | null;
}>;

export function resolveEditTables(body: TableQuadInput, current: TableQuad): TableQuad {
  // Sin mesa explícita en la edición → preservar la actual (no mover).
  if (!body.tableId) {
    return {
      tableId:       current.tableId,
      linkedTableId: current.linkedTableId,
      thirdTableId:  current.thirdTableId,
      fourthTableId: current.fourthTableId,
    };
  }
  // Mesa explícita → usar la selección recibida (combinadas opcionales).
  return {
    tableId:       body.tableId,
    linkedTableId: body.linkedTableId ?? null,
    thirdTableId:  body.thirdTableId  ?? null,
    fourthTableId: body.fourthTableId ?? null,
  };
}
