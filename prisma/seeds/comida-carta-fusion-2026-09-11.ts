import { prisma } from "../../lib/prisma";
import { TENANT, ACTIVE_STATUSES } from "../../lib/comanda";
import type { Prisma } from "@prisma/client";

/**
 * Fusión de Cartas — rediseño de la carta COMIDA (alimentos / COCINA) — 2026-09-11.
 *
 * Rediseño mayor sobre la carta del 4-sep. Aprobado: crear categorías nuevas
 * (Carpacci, Tartar, Fritti, Brasati al Vino Rosso), renombrar Antipasti→Forno y
 * Carne Wagyu→Cortes, mover platillos vivos (conservando dishId), archivar toda
 * "Especialidades del Chef" (salvo Ostiones→Sampler) + Bistecca + Carpaccio di
 * Totoaba, y desambiguar colisiones con sufijo de sección.
 *
 * Alcance: SOLO COCINA (carta Clásica + lo que sale de Autor). NO toca Postres ni
 * ninguna carta BARRA. SOLO toca platillos que cambian; los SIN_CAMBIO se dejan.
 *
 * RESOLUCIÓN POR NOMBRE+CATEGORÍA (no por dishId): los platillos creados por el
 * seed del 4-sep tienen cuid() DISTINTO en cada base (local vs prod), así que
 * hardcodear ids falla en prod. Cada fila se resuelve por su nombre VIEJO en su
 * categoría actual O por su nombre NUEVO en la categoría destino — con eso el seed
 * funciona en cualquier base y es idempotente (re-aplicar el estado destino es no-op).
 *
 * Idempotente. Todo en una transacción. DRY_RUN=1 imprime el plan sin escribir.
 * Aborta si hay CashSession OPEN o comandas activas.
 *
 * DRY:   DRY_RUN=1 npm run db:seed:comida-fusion
 * FIRME: npm run db:seed:comida-fusion
 *
 * ── LEE `decision` en filas AMBIG ANTES DEL FIRME ──
 * AMBIG = identidad no obvia (¿el viejo ES este nuevo?). Default ACTUALIZA (conserva
 * dishId e histórico). Cambia a "NUEVO_ARCHIVA" para crear nuevo y archivar el viejo.
 */

const DRY = process.env.DRY_RUN === "1";
const COCINA = "COCINA" as const;
const CLASICA = "cms6g050s0000bei84jppo9q7"; // carta Clásica (COMIDA/COCINA)

// Categorías DESTINO. forno/cortes = renombres in-place de Antipasti/Carne Wagyu (id fijo).
// carpacci/tartar/fritti/brasati se resuelven en runtime (create-or-find bajo Clásica).
const CAT_ID: Record<string, string> = {
  forno:    "cmn96kb8s0000agj3468jhuxy", // era "Antipasti"
  cortes:   "cmn96kb930005agj319dk0z6s", // era "Carne Wagyu"
  insalate: "cmn96kb910004agj3gkccyhqj",
  terra:    "cmn96kb950006agj3ls15jjd5",
  pizza:    "cmn96kb8y0002agj37i5gzjg6",
  risotto:  "cmn96kb8z0003agj31yll7u7y",
  pesce:    "cmn96kb970007agj3wkhlf5vy",
  paste:    "cmn96kb8w0001agj3mlt293ea",
};

// Categorías ACTUALES donde vive hoy cada platillo referenciado (para resolverlo por
// nombre). `antipasti` y `forno` son el MISMO id (el rename no cambia el categoryId).
const CUR = {
  antipasti: "cmn96kb8s0000agj3468jhuxy",
  terra:     "cmn96kb950006agj3ls15jjd5",
  pesce:     "cmn96kb970007agj3wkhlf5vy",
  pizza:     "cmn96kb8y0002agj37i5gzjg6",
  autor:     "cmq18yhl00000cbdihm3qgxss", // Especialidades del Chef
} as const;

const BRASATI_DESC = "Braseado 12 horas al vino tinto, sobre puré de papa sedoso y su propia salsa de cocción.";
const FRITTI_DESC = "Con aderezo tártara, salsa arrabbiata y mezcla de lechugas.";

type CatKey = keyof typeof CAT_ID | "carpacci" | "tartar" | "fritti" | "brasati";
interface Row {
  op: "UPDATE" | "NEW" | "AMBIG";
  cat: CatKey;                 // categoría DESTINO
  name: string;                // nombre DESTINO
  price: number;
  findName?: string;           // nombre ACTUAL (UPDATE/AMBIG). Omitido = igual a name.
  from?: keyof typeof CUR;     // categoría ACTUAL (UPDATE/AMBIG)
  desc?: string;
  decision?: "ACTUALIZA" | "NUEVO_ARCHIVA"; // solo AMBIG
  note?: string;
}

const PLAN: Row[] = [
  // ── CARPACCI (categoría nueva) ──
  { op: "NEW",   cat: "carpacci", name: "Tre Amici", price: 690, desc: "Atún, salmón, hamachi, aceitunas y alcaparras." },
  { op: "NEW",   cat: "carpacci", name: "Hamachi", price: 550, desc: "Aceite extra virgen, limón real, aceitunas y alcaparras." },
  { op: "AMBIG", cat: "carpacci", name: "Salmone Ora King (Carpaccio)", findName: "Carpaccio di Salmone", from: "antipasti", price: 550, decision: "ACTUALIZA", desc: "Aceite extra virgen, limón real, aceitunas y alcaparras.", note: "= 'Carpaccio di Salmone' $455 [Probable] (14 ventas)" },
  { op: "NEW",   cat: "carpacci", name: "Tonno Rosso (Carpaccio)", price: 495, desc: "Aceite extra virgen, limón real, aceitunas y alcaparras." },
  { op: "AMBIG", cat: "carpacci", name: "Wagyu (Carpaccio)", findName: "Carpaccio di Manzo", from: "antipasti", price: 495, decision: "ACTUALIZA", desc: "Aceite extra virgen, arúgula, grana padano y vinagre de módena.", note: "= 'Carpaccio di Manzo' $455 [Probable] (14 ventas)" },
  { op: "AMBIG", cat: "carpacci", name: "Polpo", findName: "Carpaccio di Polpo", from: "antipasti", price: 375, decision: "ACTUALIZA", desc: "Aceite extra virgen, limón real, grana padano, arúgula y reducción de balsámico.", note: "= 'Carpaccio di Polpo' $375 [Probable] (8 ventas)" },

  // ── FORNO (era Antipasti; los 7 clásicos quedan intactos, no aparecen) ──
  { op: "UPDATE", cat: "forno", name: "Carciofo", findName: "Carciofo alla Brace", from: "antipasti", price: 235, desc: "Alcachofa acompañada de mostaza Dijon y salsa cremosa de quesos.", note: "rename 'Carciofo alla Brace'" },
  { op: "UPDATE", cat: "forno", name: "Provola", findName: "Provola al Forno", from: "antipasti", price: 235, desc: "Sobre jitomate y pimiento rojo, perfumada con orégano y aceite de oliva extra virgen.", note: "rename 'Provola al Forno'" },
  { op: "AMBIG",  cat: "forno", name: "Sampler de Ostiones alla Parmesana", findName: "Ostiones Rockefeller", from: "autor", price: 590, decision: "ACTUALIZA", desc: "Seis distintas especies (Kumamoto, Chingón, Nativo, Turia, Black Warrior y Jumbo).", note: "= 'Ostiones Rockefeller' $590 [Probable] (4 ventas); mueve Especialidades→Forno" },

  // ── TARTAR (categoría nueva) — todo NUEVO ──
  { op: "NEW", cat: "tartar", name: "Wagyu (Tartar)", price: 690, desc: "Clásico hecho en mesa." },
  { op: "NEW", cat: "tartar", name: "Salmone Ora King (Tartar)", price: 550, desc: "Trufa negra y aguacate." },
  { op: "NEW", cat: "tartar", name: "Tonno Aleta Blue", price: 495, desc: "Cítricos y mostaza Dijon." },

  // ── FRITTI (categoría nueva) ──
  { op: "AMBIG", cat: "fritti", name: "Polpo Baby", findName: "Polpo Baby Fritto", from: "antipasti", price: 395, decision: "ACTUALIZA", desc: FRITTI_DESC, note: "= 'Polpo Baby Fritto' $455 [Probable] (11 ventas); 455→395" },
  { op: "NEW",   cat: "fritti", name: "Gamberi (Fritti)", price: 335, desc: FRITTI_DESC },
  { op: "AMBIG", cat: "fritti", name: "Calamari", findName: "Calamari Fritti", from: "antipasti", price: 295, decision: "ACTUALIZA", desc: FRITTI_DESC, note: "= 'Calamari Fritti' $275 [Probable] (0 ventas); 275→295" },
  { op: "NEW",   cat: "fritti", name: "Jaiba Blue (2 pzs)", price: 275, desc: FRITTI_DESC },

  // ── CORTES (era Carne Wagyu): 7 cortes SIN_CAMBIO, solo renombre de categoría ──

  // ── TERRA (Bistecca→archivo; Brasato/Costata→Brasati) ──
  { op: "UPDATE", cat: "terra", name: "Filetto del Chef", findName: "Filetto del Chef", from: "terra", price: 790, note: "reprecio 990→790" },

  // ── BRASATI AL VINO ROSSO (categoría nueva) ──
  { op: "NEW",   cat: "brasati", name: "Lengua", price: 650, desc: BRASATI_DESC },
  { op: "AMBIG", cat: "brasati", name: "Brisket", findName: "Brasato al Vino Rosso", from: "terra", price: 590, decision: "ACTUALIZA", desc: BRASATI_DESC, note: "= 'Brasato al Vino Rosso' $590 [Probable] (9 ventas); mueve a Brasati" },
  { op: "AMBIG", cat: "brasati", name: "Costilla", findName: "Costata del Nonno", from: "terra", price: 550, decision: "ACTUALIZA", desc: BRASATI_DESC, note: "= 'Costata del Nonno' $550 [Probable] (10 ventas); mueve a Brasati" },
  { op: "NEW",   cat: "brasati", name: "Suadero", price: 490, desc: BRASATI_DESC },

  // ── PIZZA (solo desambiguar Gamberi) ──
  { op: "UPDATE", cat: "pizza", name: "Gamberi (Pizza)", findName: "Gamberi", from: "pizza", price: 355, note: "rename por colisión con 'Gamberi (Fritti)'" },

  // ── PESCE DEL GIORNO ──
  { op: "NEW",    cat: "pesce", name: "Aragosta allo Scoglio", price: 1150, desc: "250 gr de cola de langosta con frutos del mar: camarón, mejillón, calamar, pulpo, almejas y fregola sarda." },
  { op: "UPDATE", cat: "pesce", name: "Salmone Ora King alla Rosina", findName: "Salmone Ora King alla Rosina", from: "pesce", price: 790, note: "reprecio 990→790" },
  { op: "UPDATE", cat: "pesce", name: "Totoaba alla Livornese", findName: "Totoaba alla Livornese", from: "pesce", price: 690, note: "reprecio 790→690" },
  { op: "AMBIG",  cat: "pesce", name: "Salmone al Vino Bianco", findName: "Salmone all'Acqua Pazza", from: "pesce", price: 550, decision: "ACTUALIZA", desc: "A la leña con vino blanco, alcaparras, aceitunas y jitomate cherry servido sobre pepperonata (estofado con pimiento rojo, cebolla y berenjenas).", note: "= 'Salmone all'Acqua Pazza' $650 [Probable] (0 ventas)" },
  { op: "UPDATE", cat: "pesce", name: "Tonno Rosso (Pesca)", findName: "Tonno Rosso", from: "pesce", price: 550, desc: "Lomo de atún aleta azul sellado, arúgula, láminas de grana padano, estofado de frutos rojos y vinagre balsámico.", note: "650→550 + sufijo por colisión con carpaccio" },
  { op: "UPDATE", cat: "pesce", name: "Totoaba al Limone", findName: "Totoaba al Limone", from: "pesce", price: 495, note: "reprecio 595→495" },
];

// ARCHIVAR (active:false + archivedAt). Resuelto por (nombre, categoría actual).
const ARCHIVE: { findName: string; from: keyof typeof CUR }[] = [
  { findName: "Aguachile Tatemado", from: "autor" },
  { findName: "Aguachile Verde", from: "autor" },
  { findName: "Cola de Langosta Roja (100 GR)", from: "autor" },
  { findName: "Crudo de Atún Aleta Azul", from: "autor" },
  { findName: "Crudo de Salmón Ora King", from: "autor" },
  { findName: "Crudo de Totoaba", from: "autor" },
  { findName: "Hamburguesa c/queso", from: "autor" },
  { findName: "Hamburguesa s/queso", from: "autor" },
  { findName: "King Kampachi (100 GR)", from: "autor" },
  { findName: "Ostiones al natural", from: "autor" },
  { findName: "Pulpo Vulgaris (100 GR)", from: "autor" },
  { findName: "Taco de Arrachera", from: "autor" },
  { findName: "Taco de Costilla del siete", from: "autor" },
  { findName: "Taco de Gaonera de Diezmillo", from: "autor" },
  { findName: "Taco de Jaiba Suave Frita", from: "autor" },
  { findName: "Taco de Lengua", from: "autor" },
  { findName: "Taco de Pulpo Zarandeado", from: "autor" },
  { findName: "Taco de Suadero Confitado", from: "autor" },
  { findName: "Bistecca alla Fiorentina", from: "terra" },
  { findName: "Carpaccio di Totoaba al Tartufo", from: "antipasti" },
];

const CAT_ORDER = ["carpacci","forno","tartar","fritti","insalate","cortes","terra","brasati","pizza","risotto","pesce","paste"] as const;
const tag = (s: string) => `${DRY ? "[DRY] " : ""}${s}`;

type Found = { id: string; name: string; price: number; categoryId: string; active: boolean };

async function main() {
  console.log(`\n── Fusión de Cartas COMIDA 2026-09-11 ${DRY ? "(DRY_RUN: no escribe)" : "(EN FIRME)"} ──\n`);

  // 1) GUARD
  const openSession = await prisma.cashSession.findFirst({ where: { tenantId: TENANT, status: "OPEN" }, select: { folio: true } });
  if (openSession) throw new Error(`ABORTA: CashSession OPEN (${openSession.folio}). Cierra el turno antes de sembrar.`);
  const activas = await prisma.comanda.count({ where: { tenantId: TENANT, status: { in: [...ACTIVE_STATUSES] } } });
  if (activas > 0) throw new Error(`ABORTA: ${activas} comanda(s) activa(s). Cóbralas o ciérralas antes de sembrar.`);
  console.log("Guard OK: sin caja abierta, sin comandas activas.\n");

  const plan = { rename: 0, newcat: 0, update: 0, ambig: 0, create: 0, archiva: 0 };

  const run = async (tx: Prisma.TransactionClient) => {
    const db = DRY ? prisma : tx;

    // Resuelve un platillo existente por nombre VIEJO@cat-actual O nombre NUEVO@cat-destino.
    // Sirve antes y después de aplicar (idempotente) y es independiente del cuid por base.
    const resolve = async (r: Row): Promise<Found | null> => {
      const targetCat = CAT_ID[r.cat];
      const or: Prisma.DishWhereInput[] = [];
      if (r.findName && r.from) or.push({ name: r.findName, categoryId: CUR[r.from] });
      if (targetCat && !targetCat.startsWith("<")) or.push({ name: r.name, categoryId: targetCat });
      if (or.length === 0) return null;
      return db.dish.findFirst({ where: { OR: or }, select: { id: true, name: true, price: true, categoryId: true, active: true } });
    };

    // 2) Setup de categorías: renombrar + crear
    console.log("Categorías:");
    if (!DRY) {
      await tx.menuCategory.update({ where: { id: CAT_ID.forno }, data: { name: "Forno" } });
      await tx.menuCategory.update({ where: { id: CAT_ID.cortes }, data: { name: "Cortes" } });
    }
    plan.rename += 2;
    console.log(tag("   ✎ rename 'Antipasti'→'Forno', 'Carne Wagyu'→'Cortes'"));
    for (const key of ["carpacci", "tartar", "fritti", "brasati"] as const) {
      const nm = key === "carpacci" ? "Carpacci" : key === "tartar" ? "Tartar" : key === "fritti" ? "Fritti" : "Brasati al Vino Rosso";
      const existing = await db.menuCategory.findFirst({ where: { name: nm, cartaId: CLASICA }, select: { id: true } });
      if (existing) { CAT_ID[key] = existing.id; console.log(tag(`   ↩  categoría "${nm}": ya existe`)); continue; }
      plan.newcat++;
      if (DRY) { CAT_ID[key] = `<nueva:${nm}>`; console.log(tag(`   ✚ crear categoría "${nm}"`)); continue; }
      const c = await tx.menuCategory.create({ data: { name: nm, cartaId: CLASICA, visible: true }, select: { id: true } });
      CAT_ID[key] = c.id; console.log(`   ✚ categoría "${nm}" creada (${c.id})`);
    }
    for (let i = 0; i < CAT_ORDER.length; i++) {
      const id = CAT_ID[CAT_ORDER[i]];
      if (!DRY && id && !id.startsWith("<")) await tx.menuCategory.update({ where: { id }, data: { position: i + 1 } });
    }
    console.log(tag(`   ✎ posiciones de las ${CAT_ORDER.length} categorías (orden de carta)`));

    // 3) Validación: cada fila UPDATE/AMBIG + cada ARCHIVE debe resolver a un platillo vivo.
    const errs: string[] = [];
    for (const r of PLAN) if (r.op !== "NEW") { if (!(await resolve(r))) errs.push(`PLAN: no encontrado "${r.findName ?? r.name}" (${r.from ?? r.cat})`); }
    for (const a of ARCHIVE) {
      const f = await db.dish.findFirst({ where: { name: a.findName, categoryId: CUR[a.from] }, select: { id: true } });
      if (!f) errs.push(`ARCHIVE: no encontrado "${a.findName}" (${a.from})`);
    }
    if (errs.length) { errs.forEach((e) => console.error("  ✗ " + e)); throw new Error("Validación falló (platillos no encontrados por nombre+categoría)."); }
    console.log(tag(`\nValidación OK: ${PLAN.filter((r) => r.op !== "NEW").length} a actualizar + ${ARCHIVE.length} a archivar resueltos.`));

    // contador de posición por categoría (para nuevos y movidos)
    const posCounter: Record<string, number> = {};
    const nextPos = async (cat: string) => {
      if (posCounter[cat] == null) {
        const id = CAT_ID[cat];
        const agg = (!id || id.startsWith("<")) ? { _max: { position: null as number | null } } : await db.dish.aggregate({ where: { categoryId: id, active: true }, _max: { position: true } });
        posCounter[cat] = agg._max.position ?? 0;
      }
      return ++posCounter[cat];
    };

    // 4) PLAN
    console.log("\nPlatillos:");
    const createDish = async (r: Row) => {
      const catId = CAT_ID[r.cat];
      const exists = (!catId || catId.startsWith("<")) ? null : await db.dish.findFirst({ where: { name: r.name, categoryId: catId }, select: { id: true } });
      if (exists) { console.log(tag(`   ↩  NEW "${r.name}": ya existe`)); return; }
      const position = await nextPos(r.cat);
      plan.create++;
      if (DRY) { console.log(tag(`   ✚ NEW "${r.name}" $${r.price} → ${r.cat} pos=${position}`)); return; }
      await tx.dish.create({ data: { name: r.name, description: r.desc ?? null, price: r.price, categoryId: catId, prepArea: COCINA, available: true, active: true, position } });
      console.log(`   ✚ NEW "${r.name}" $${r.price} → ${r.cat} pos=${position}`);
    };
    const updateDish = async (r: Row, kind: string) => {
      const cur = await resolve(r);
      if (!cur) throw new Error(`No se pudo resolver "${r.findName ?? r.name}" (${r.from ?? r.cat})`);
      const targetCat = CAT_ID[r.cat];
      const moving = cur.categoryId !== targetCat;
      const position = moving ? await nextPos(r.cat) : undefined;
      if (r.op === "AMBIG") plan.ambig++; else plan.update++;
      const label = `${kind} "${cur.name}" $${cur.price} → "${r.name}" $${r.price} [${r.cat}]${moving ? " (mueve)" : ""}`;
      if (DRY) { console.log(tag(`   ✎ ${label}`)); return; }
      await tx.dish.update({ where: { id: cur.id }, data: { name: r.name, price: r.price, prepArea: COCINA, active: true, archivedAt: null, categoryId: targetCat, ...(r.desc !== undefined ? { description: r.desc } : {}), ...(position != null ? { position } : {}) } });
      console.log(`   ✎ ${label}`);
    };

    for (const r of PLAN) {
      if (r.op === "NEW") await createDish(r);
      else if (r.op === "UPDATE") await updateDish(r, "UPDATE");
      else if (r.op === "AMBIG") {
        if (r.decision === "NUEVO_ARCHIVA") {
          console.log(tag(`   ⇄ AMBIG "${r.name}" = NUEVO + ARCHIVA viejo`));
          await createDish({ ...r, op: "NEW" });
          const old = await db.dish.findFirst({ where: { name: r.findName!, categoryId: CUR[r.from!] }, select: { id: true, name: true, active: true } });
          if (old && old.active) { plan.archiva++; if (!DRY) await tx.dish.update({ where: { id: old.id }, data: { active: false, archivedAt: new Date() } }); console.log(tag(`   ▢ ARCHIVA "${old.name}"`)); }
        } else await updateDish(r, "AMBIG→ACT");
      }
    }

    // 5) Archivar
    console.log("\nArchivar (Especialidades del Chef + Bistecca + Carpaccio di Totoaba):");
    for (const a of ARCHIVE) {
      const cur = await db.dish.findFirst({ where: { name: a.findName, categoryId: CUR[a.from] }, select: { id: true, name: true, active: true } });
      if (!cur) { console.log(tag(`   ⚠  "${a.findName}": no encontrado (¿ya movido?)`)); continue; }
      if (!cur.active) { console.log(tag(`   ↩  "${a.findName}": ya inactivo`)); continue; }
      plan.archiva++;
      if (DRY) { console.log(tag(`   ▢ ARCHIVA "${cur.name}"`)); continue; }
      await tx.dish.update({ where: { id: cur.id }, data: { active: false, archivedAt: new Date() } });
      console.log(`   ▢ ARCHIVA "${cur.name}"`);
    }
  };

  if (DRY) {
    await run({} as Prisma.TransactionClient);
    console.log(`\n[DRY] Resumen: cat rename ${plan.rename} · cat nuevas ${plan.newcat} · UPDATE ${plan.update} · AMBIG ${plan.ambig} · NUEVO ${plan.create} · ARCHIVA ${plan.archiva}`);
    console.log("\nDRY_RUN=1 → NO se escribió nada.\n");
    return;
  }
  await prisma.$transaction(run, { timeout: 120_000, maxWait: 15_000 });
  console.log(`\nResumen: cat rename ${plan.rename} · cat nuevas ${plan.newcat} · UPDATE ${plan.update} · AMBIG ${plan.ambig} · NUEVO ${plan.create} · ARCHIVA ${plan.archiva}`);
  console.log("Listo.\n");
}

main()
  .catch((e) => { console.error("\nError en comida-carta-fusion-2026-09-11:", e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
