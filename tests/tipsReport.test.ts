import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateTipsRange, type TipsSessionReport, type TipsWaiterRow } from "../lib/tipsReport";

// Constructor de un reporte de turno con valores por defecto; cada prueba pisa
// solo los campos que le importan. aggregateTipsRange es pura: no toca base.
function mk(partial: Partial<TipsSessionReport>): TipsSessionReport {
  return {
    cashSessionId: 1,
    waiters: [],
    pool: 0,
    tipsRegistered: 0,
    tipsRegisteredAll: 0,
    sinElPunto: 0,
    areas: [],
    areasPolicyIsCurrent: true,
    estimados: 0,
    ...partial,
  };
}

// Fila mínima de mesero; solo importa `salesAfterSettle` para estas pruebas.
function wrow(salesAfterSettle: number): TipsWaiterRow {
  return {
    waiterId: 1,
    fullName: "X",
    salesTotal: 0,
    tipsRegistered: 0,
    reserveDigital: 0,
    pointPercent: 7,
    deduction: 0,
    net: 0,
    direction: "EVEN",
    amount: 0,
    salesAfterSettle,
    estimado: false,
    settledAt: null,
    settledBy: null,
  };
}

test("dos turnos con las mismas áreas: suma por nombre, sin duplicar", () => {
  const a = mk({ areas: [{ name: "Barra", percent: 2, amount: 10 }, { name: "Cocina", percent: 2.5, amount: 20 }] });
  const b = mk({ areas: [{ name: "Barra", percent: 2, amount: 5 }, { name: "Cocina", percent: 2.5, amount: 7 }] });
  const r = aggregateTipsRange([a, b]);
  assert.equal(r.areas.length, 2);
  const byName = Object.fromEntries(r.areas.map((x) => [x.name, x.amount]));
  assert.equal(byName["Barra"], 15);
  assert.equal(byName["Cocina"], 27);
});

test("dos turnos con áreas distintas (cambió la póliza): aparecen todas", () => {
  const a = mk({ areas: [{ name: "Barra", percent: 2, amount: 10 }] });
  const b = mk({ areas: [{ name: "Garroteros", percent: 1, amount: 4 }] });
  const r = aggregateTipsRange([a, b]);
  assert.equal(r.areas.length, 2);
  const names = r.areas.map((x) => x.name).sort();
  assert.deepEqual(names, ["Barra", "Garroteros"]);
});

test("sinElPunto negativo: se conserva el signo", () => {
  const a = mk({ sinElPunto: -50 });
  const b = mk({ sinElPunto: 20 });
  const r = aggregateTipsRange([a, b]);
  assert.equal(r.sinElPunto, -30);
  assert.ok(r.sinElPunto < 0);
});

test("estimados: suma entre turnos", () => {
  const r = aggregateTipsRange([mk({ estimados: 1 }), mk({ estimados: 2 }), mk({ estimados: 0 })]);
  assert.equal(r.estimados, 3);
});

test("lista vacía: todo en cero, sin romper", () => {
  const r = aggregateTipsRange([]);
  assert.equal(r.cortes, 0);
  assert.equal(r.pool, 0);
  assert.equal(r.tipsRegistered, 0);
  assert.equal(r.tipsRegisteredAll, 0);
  assert.equal(r.sinElPunto, 0);
  assert.equal(r.estimados, 0);
  assert.deepEqual(r.areas, []);
});

test("redondeo: centavos que arrastran cuadran a 2 decimales al final", () => {
  // 0.1 + 0.2 + 0.3 en float da 0.6000000000000001; debe quedar 0.6 exacto.
  const sessions = [
    mk({ pool: 0.1, tipsRegistered: 0.1, areas: [{ name: "Barra", percent: 2, amount: 0.1 }] }),
    mk({ pool: 0.2, tipsRegistered: 0.2, areas: [{ name: "Barra", percent: 2, amount: 0.2 }] }),
    mk({ pool: 0.3, tipsRegistered: 0.3, areas: [{ name: "Barra", percent: 2, amount: 0.3 }] }),
  ];
  const r = aggregateTipsRange(sessions);
  assert.equal(r.pool, 0.6);
  assert.equal(r.tipsRegistered, 0.6);
  assert.equal(r.areas[0].amount, 0.6);
});

test("salesAfterSettle: suma entre turnos y cuenta a los meseros con venta posterior", () => {
  const a = mk({ waiters: [wrow(100), wrow(0)] });   // 1 con venta posterior
  const b = mk({ waiters: [wrow(50), wrow(25)] });    // 2 con venta posterior
  const r = aggregateTipsRange([a, b]);
  assert.equal(r.salesAfterSettle, 175);
  assert.equal(r.conVentaPosterior, 3);
});

test("un turno sin venta posterior no infla el conteo", () => {
  const a = mk({ waiters: [wrow(0), wrow(0)] });
  const b = mk({ waiters: [wrow(40)] });
  const r = aggregateTipsRange([a, b]);
  assert.equal(r.salesAfterSettle, 40);
  assert.equal(r.conVentaPosterior, 1);
});
