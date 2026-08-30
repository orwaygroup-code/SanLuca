/**
 * Tests de la jerarquía que autoriza una reimpresión. Sin DB.
 *   npx tsx --test tests/reprintAuth.test.ts
 *
 * La regla la comparten dos endpoints —el ticket del cliente y la reimpresión a
 * cocina—, así que se prueba una vez aquí en lugar de confiar en que ambos la
 * repitan igual.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  resolveReprintAuthorizer,
  isReprintAuthorizer,
  REPRINT_AUTHORIZER_ROLES,
} from "../lib/comandaRules";

test("solo Capitán, Manager y Admin reimprimen sin que nadie los autorice", () => {
  assert.equal(isReprintAuthorizer("CAPTAIN"), true);
  assert.equal(isReprintAuthorizer("MANAGER"), true);
  assert.equal(isReprintAuthorizer("ADMIN"), true);
  assert.equal(isReprintAuthorizer("OPERATION"), false);
  assert.equal(isReprintAuthorizer("WAITER"), false);
  assert.equal(isReprintAuthorizer("KITCHEN"), false);
  assert.equal(isReprintAuthorizer(null), false);
  assert.equal(isReprintAuthorizer(undefined), false);
});

test("el supervisor en sesión queda registrado como quien autoriza, sin PIN", () => {
  const r = resolveReprintAuthorizer({ operatorRole: "CAPTAIN", operatorStaffId: 7 });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.authorizedById, 7);
});

test("el cajero sin PIN no reimprime", () => {
  const r = resolveReprintAuthorizer({ operatorRole: "OPERATION", operatorStaffId: 3 });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.status, 403);
});

test("el cajero con PIN válido reimprime, y el autorizador es el del PIN, no él", () => {
  const r = resolveReprintAuthorizer({
    operatorRole: "OPERATION", operatorStaffId: 3,
    pinProvided: true, pinAuthorizedId: 12,
  });
  assert.equal(r.ok, true);
  // Distinguir quién imprime de quién autoriza es el punto de la auditoría.
  assert.equal(r.ok && r.authorizedById, 12);
});

test("un PIN que no es de Capitán ni Manager no autoriza", () => {
  // La verificación devuelve null cuando el PIN no corresponde a ninguno de los
  // roles pedidos; aquí se comprueba que eso se traduzca en un rechazo.
  const r = resolveReprintAuthorizer({
    operatorRole: "OPERATION", operatorStaffId: 3,
    pinProvided: true, pinAuthorizedId: null,
  });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.status, 403);
  assert.match(r.ok === false ? r.error : "", /PIN incorrecto/i);
});

test("un mesero tampoco reimprime aunque sea su comanda", () => {
  const r = resolveReprintAuthorizer({ operatorRole: "WAITER", operatorStaffId: 20 });
  assert.equal(r.ok, false);
});

test("los roles que autorizan son exactamente Capitán y Manager", () => {
  // Si alguien agrega un rol aquí, que sea a propósito: este arreglo es el que
  // se le pasa a la verificación de PIN en los dos endpoints.
  assert.deepEqual([...REPRINT_AUTHORIZER_ROLES], ["CAPTAIN", "MANAGER"]);
});
