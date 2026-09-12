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
 * ninguna carta BARRA (Bebidas/Destilados/Vinos). SOLO toca platillos que cambian;
 * los SIN_CAMBIO se dejan intactos (no aparecen aquí).
 *
 * Idempotente. Todo en una transacción. DRY_RUN=1 imprime el plan sin escribir.
 * Aborta si hay CashSession OPEN o comandas activas.
 *
 * DRY:   DRY_RUN=1 npm run db:seed:comida-fusion
 * FIRME: npm run db:seed:comida-fusion
 *
 * ── LEE EL BLOQUE `DECISIONES` (campo `decision` en filas AMBIG) ANTES DEL FIRME ──
 * AMBIG = identidad no obvia (¿el viejo ES este nuevo?). Default ACTUALIZA (conserva
 * dishId e histórico). Cambia a "NUEVO_ARCHIVA" para crear nuevo y archivar el viejo.
 */

const DRY = process.env.DRY_RUN === "1";
const COCINA = "COCINA" as const;
const CLASICA = "cms6g050s0000bei84jppo9q7"; // carta Clásica (COMIDA/COCINA)

// Categorías existentes (ids fijos). forno/cortes son renombres de Antipasti/Carne Wagyu.
const CAT_ID: Record<string, string> = {
  forno:    "cmn96kb8s0000agj3468jhuxy", // era "Antipasti"
  cortes:   "cmn96kb930005agj319dk0z6s", // era "Carne Wagyu"
  insalate: "cmn96kb910004agj3gkccyhqj",
  terra:    "cmn96kb950006agj3ls15jjd5",
  pizza:    "cmn96kb8y0002agj37i5gzjg6",
  risotto:  "cmn96kb8z0003agj31yll7u7y",
  pesce:    "cmn96kb970007agj3wkhlf5vy",
  paste:    "cmn96kb8w0001agj3mlt293ea",
  // carpacci / tartar / fritti / brasati → resueltos en runtime (create-or-find)
};

const BRASATI_DESC = "Braseado 12 horas al vino tinto, sobre puré de papa sedoso y su propia salsa de cocción.";
const FRITTI_DESC = "Con aderezo tártara, salsa arrabbiata y mezcla de lechugas.";

type Op = "UPDATE" | "NEW" | "AMBIG";
interface Row {
  op: Op;
  cat: keyof typeof CAT_ID | "carpacci" | "tartar" | "fritti" | "brasati";
  name: string;
  price: number;
  id?: string;              // UPDATE / AMBIG
  desc?: string;            // set descripción (NEW o renombre/reubicación)
  move?: boolean;           // cambia de categoría (o es nuevo) → asigna posición
  decision?: "ACTUALIZA" | "NUEVO_ARCHIVA"; // solo AMBIG
  note?: string;
}

// Orden de PLAN dentro de cada categoría = orden de la carta impresa.
const PLAN: Row[] = [
  // ── CARPACCI (categoría nueva) ──
  { op: "NEW",   cat: "carpacci", name: "Tre Amici", price: 690, move: true, desc: "Atún, salmón, hamachi, aceitunas y alcaparras." },
  { op: "NEW",   cat: "carpacci", name: "Hamachi", price: 550, move: true, desc: "Aceite extra virgen, limón real, aceitunas y alcaparras." },
  { op: "AMBIG", cat: "carpacci", id: "cmn96kbaw0012agj3cz6w3aig", name: "Salmone Ora King (Carpaccio)", price: 550, move: true, decision: "ACTUALIZA", desc: "Aceite extra virgen, limón real, aceitunas y alcaparras.", note: "= 'Carpaccio di Salmone' $455 [Probable] mismo (14 ventas)" },
  { op: "NEW",   cat: "carpacci", name: "Tonno Rosso (Carpaccio)", price: 495, move: true, desc: "Aceite extra virgen, limón real, aceitunas y alcaparras." },
  { op: "AMBIG", cat: "carpacci", id: "cmn96kbaw0013agj3k7ycg4dj", name: "Wagyu (Carpaccio)", price: 495, move: true, decision: "ACTUALIZA", desc: "Aceite extra virgen, arúgula, grana padano y vinagre de módena.", note: "= 'Carpaccio di Manzo' $455 [Probable] (14 ventas)" },
  { op: "AMBIG", cat: "carpacci", id: "cmn96kbaw0016agj308hdh7iq", name: "Polpo", price: 375, move: true, decision: "ACTUALIZA", desc: "Aceite extra virgen, limón real, grana padano, arúgula y reducción de balsámico.", note: "= 'Carpaccio di Polpo' $375 [Probable] (8 ventas)" },

  // ── FORNO (era Antipasti; los 7 clásicos quedan intactos) ──
  { op: "UPDATE", cat: "forno", id: "cmn96kbaw001gagj32u1bsso5", name: "Carciofo", price: 235, desc: "Alcachofa acompañada de mostaza Dijon y salsa cremosa de quesos.", note: "rename 'Carciofo alla Brace'" },
  { op: "UPDATE", cat: "forno", id: "cmn96kbaw001dagj3hgrgn5el", name: "Provola", price: 235, desc: "Sobre jitomate y pimiento rojo, perfumada con orégano y aceite de oliva extra virgen.", note: "rename 'Provola al Forno'" },
  { op: "AMBIG",  cat: "forno", id: "cmq18yhlt0006cbdimtsl42ko", name: "Sampler de Ostiones alla Parmesana", price: 590, move: true, decision: "ACTUALIZA", desc: "Seis distintas especies (Kumamoto, Chingón, Nativo, Turia, Black Warrior y Jumbo).", note: "= 'Ostiones Rockefeller' $590 [Probable] (4 ventas); mueve de Especialidades a Forno" },

  // ── TARTAR (categoría nueva) — todo NUEVO ──
  { op: "NEW", cat: "tartar", name: "Wagyu (Tartar)", price: 690, move: true, desc: "Clásico hecho en mesa." },
  { op: "NEW", cat: "tartar", name: "Salmone Ora King (Tartar)", price: 550, move: true, desc: "Trufa negra y aguacate." },
  { op: "NEW", cat: "tartar", name: "Tonno Aleta Blue", price: 495, move: true, desc: "Cítricos y mostaza Dijon." },

  // ── FRITTI (categoría nueva) ──
  { op: "AMBIG", cat: "fritti", id: "cmn96kbaw0018agj3t0vqkqlw", name: "Polpo Baby", price: 395, move: true, decision: "ACTUALIZA", desc: FRITTI_DESC, note: "= 'Polpo Baby Fritto' $455 [Probable] (11 ventas); reprecio 455→395" },
  { op: "NEW",   cat: "fritti", name: "Gamberi (Fritti)", price: 335, move: true, desc: FRITTI_DESC },
  { op: "AMBIG", cat: "fritti", id: "cmn96kbaw001aagj3wf7sk81x", name: "Calamari", price: 295, move: true, decision: "ACTUALIZA", desc: FRITTI_DESC, note: "= 'Calamari Fritti' $275 [Probable] (0 ventas); 275→295" },
  { op: "NEW",   cat: "fritti", name: "Jaiba Blue (2 pzs)", price: 275, move: true, desc: FRITTI_DESC },

  // ── CORTES (era Carne Wagyu): 7 cortes SIN_CAMBIO, solo renombre de categoría ──

  // ── TERRA (Bistecca se archiva; Brasato/Costata se van a Brasati) ──
  { op: "UPDATE", cat: "terra", id: "cmtn7s0g900105ae3tr1v7oex", name: "Filetto del Chef", price: 790, note: "reprecio 990→790" },

  // ── BRASATI AL VINO ROSSO (categoría nueva) ──
  { op: "NEW",   cat: "brasati", name: "Lengua", price: 650, move: true, desc: BRASATI_DESC },
  { op: "AMBIG", cat: "brasati", id: "cmn96kbbn002zagj3nuty5sq9", name: "Brisket", price: 590, move: true, decision: "ACTUALIZA", desc: BRASATI_DESC, note: "= 'Brasato al Vino Rosso' $590 [Probable] (9 ventas); mueve a Brasati" },
  { op: "AMBIG", cat: "brasati", id: "cmn96kbbn002yagj314mm2lew", name: "Costilla", price: 550, move: true, decision: "ACTUALIZA", desc: BRASATI_DESC, note: "= 'Costata del Nonno' $550 [Probable] (10 ventas); mueve a Brasati" },
  { op: "NEW",   cat: "brasati", name: "Suadero", price: 490, move: true, desc: BRASATI_DESC },

  // ── PIZZA (solo desambiguar Gamberi) ──
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb70023agj3fr3mscwm", name: "Gamberi (Pizza)", price: 355, note: "rename por colisión con 'Gamberi (Fritti)'" },

  // ── PESCE DEL GIORNO ──
  { op: "NEW",    cat: "pesce", name: "Aragosta allo Scoglio", price: 1150, move: true, desc: "250 gr de cola de langosta con frutos del mar: camarón, mejillón, calamar, pulpo, almejas y fregola sarda." },
  { op: "UPDATE", cat: "pesce", id: "cmn96kbbr0033agj337mg14il", name: "Salmone Ora King alla Rosina", price: 790, note: "reprecio 990→790" },
  { op: "UPDATE", cat: "pesce", id: "cmn96kbbr0034agj32w8i0qsn", name: "Totoaba alla Livornese", price: 690, note: "reprecio 790→690" },
  { op: "AMBIG",  cat: "pesce", id: "cmtn7s0gj00145ae3uadr5v9p", name: "Salmone al Vino Bianco", price: 550, decision: "ACTUALIZA", desc: "A la leña con vino blanco, alcaparras, aceitunas y jitomate cherry servido sobre pepperonata (estofado con pimiento rojo, cebolla y berenjenas).", note: "= 'Salmone all'Acqua Pazza' $650 [Probable] (0 ventas); rename+reprecio" },
  { op: "UPDATE", cat: "pesce", id: "cmtn7s0gl00165ae331tnxwev", name: "Tonno Rosso (Pesca)", price: 550, desc: "Lomo de atún aleta azul sellado, arúgula, láminas de grana padano, estofado de frutos rojos y vinagre balsámico.", note: "reprecio 650→550 + sufijo por colisión con carpaccio" },
  { op: "UPDATE", cat: "pesce", id: "cmtn7s0gn00185ae3t1tl009d", name: "Totoaba al Limone", price: 495, note: "reprecio 595→495" },
];

// Platillos a ARCHIVAR (active:false + archivedAt). Especialidades del Chef (salvo Ostiones,
// que se movió a Forno) + Bistecca + Carpaccio di Totoaba.
const ARCHIVE: { id: string; label: string }[] = [
  { id: "cmq18yhmc000gcbdimac8dvh3", label: "Aguachile Tatemado" },
  { id: "cmtn7s0fj000w5ae3iu17edn3", label: "Aguachile Verde" },
  { id: "cmtn7s0f6000i5ae3f23o6xit", label: "Cola de Langosta Roja (100 GR)" },
  { id: "cmq18yhlz000acbdi3c97k4f7", label: "Crudo de Atún Aleta Azul" },
  { id: "cmtn7s0fb000o5ae3nusymkka", label: "Crudo de Salmón Ora King" },
  { id: "cmtn7s0fe000q5ae3rz0fx2no", label: "Crudo de Totoaba" },
  { id: "cmtn7s0f5000g5ae3pddarf7j", label: "Hamburguesa c/queso" },
  { id: "cmq18yhm9000ecbdighto54bj", label: "Hamburguesa s/queso" },
  { id: "cmtn7s0fa000m5ae3m2mrdv8o", label: "King Kampachi (100 GR)" },
  { id: "cmtn7s0ff000s5ae33f3csu24", label: "Ostiones al natural" },
  { id: "cmtn7s0f9000k5ae3sivmgc1l", label: "Pulpo Vulgaris (100 GR)" },
  { id: "cmtn7s0f2000c5ae3yk36ksrd", label: "Taco de Arrachera" },
  { id: "cmtn7s0f3000e5ae3fb4ma9se", label: "Taco de Costilla del siete" },
  { id: "cmtn7s0f1000a5ae3zrdegxji", label: "Taco de Gaonera de Diezmillo" },
  { id: "cmq18yhmg000kcbdi1kwvfxxs", label: "Taco de Jaiba Suave Frita" },
  { id: "cmtn7s0ez00085ae37zgka3ne", label: "Taco de Lengua" },
  { id: "cmtn7s0fh000u5ae3w3o6rmam", label: "Taco de Pulpo Zarandeado" },
  { id: "cmq18yhmi000mcbdidfdc36g8", label: "Taco de Suadero Confitado" },
  { id: "cmtn7s0g8000y5ae3wyxxb6y2", label: "Bistecca alla Fiorentina" },
  { id: "cmn96kbaw0017agj3kkqdlqx3", label: "Carpaccio di Totoaba al Tartufo" },
];

// Orden de categorías en el menú (carta impresa).
const CAT_ORDER = ["carpacci","forno","tartar","fritti","insalate","cortes","terra","brasati","pizza","risotto","pesce","paste"] as const;

const tag = (s: string) => `${DRY ? "[DRY] " : ""}${s}`;

async function main() {
  console.log(`\n── Fusión de Cartas COMIDA 2026-09-11 ${DRY ? "(DRY_RUN: no escribe)" : "(EN FIRME)"} ──\n`);

  // 1) GUARD
  const openSession = await prisma.cashSession.findFirst({ where: { tenantId: TENANT, status: "OPEN" }, select: { folio: true } });
  if (openSession) throw new Error(`ABORTA: CashSession OPEN (${openSession.folio}). Cierra el turno antes de sembrar.`);
  const activas = await prisma.comanda.count({ where: { tenantId: TENANT, status: { in: [...ACTIVE_STATUSES] } } });
  if (activas > 0) throw new Error(`ABORTA: ${activas} comanda(s) activa(s). Cóbralas o ciérralas antes de sembrar.`);
  console.log("Guard OK: sin caja abierta, sin comandas activas.\n");

  // 2) Validación de dishIds del PLAN + ARCHIVE
  const ids = [...PLAN.filter((r) => r.id).map((r) => ({ id: r.id!, name: r.name })), ...ARCHIVE.map((a) => ({ id: a.id, name: a.label }))];
  for (const r of ids) {
    const d = await prisma.dish.findUnique({ where: { id: r.id }, select: { id: true } });
    if (!d) throw new Error(`dishId no existe: ${r.name} (${r.id})`);
  }
  console.log(`Validación OK: ${ids.length} dishId existen.\n`);

  const plan = { rename: 0, create: 0, update: 0, ambig: 0, archiva: 0, newcat: 0 };
  const run = async (tx: Prisma.TransactionClient) => {
    const db = DRY ? prisma : tx;

    // 3) Setup de categorías: renombrar + crear
    console.log("Categorías:");
    if (!DRY) {
      await tx.menuCategory.update({ where: { id: CAT_ID.forno }, data: { name: "Forno" } });
      await tx.menuCategory.update({ where: { id: CAT_ID.cortes }, data: { name: "Cortes" } });
    }
    plan.rename += 2;
    console.log(tag(`   ✎ rename 'Antipasti'→'Forno', 'Carne Wagyu'→'Cortes'`));
    for (const key of ["carpacci", "tartar", "fritti", "brasati"] as const) {
      const nm = key === "carpacci" ? "Carpacci" : key === "tartar" ? "Tartar" : key === "fritti" ? "Fritti" : "Brasati al Vino Rosso";
      const existing = await db.menuCategory.findFirst({ where: { name: nm, cartaId: CLASICA }, select: { id: true } });
      if (existing) { CAT_ID[key] = existing.id; console.log(tag(`   ↩  categoría "${nm}": ya existe (${existing.id})`)); continue; }
      plan.newcat++;
      if (DRY) { CAT_ID[key] = `<nueva:${nm}>`; console.log(tag(`   ✚ crear categoría "${nm}"`)); continue; }
      const c = await tx.menuCategory.create({ data: { name: nm, cartaId: CLASICA, visible: true }, select: { id: true } });
      CAT_ID[key] = c.id; console.log(`   ✚ categoría "${nm}" creada (${c.id})`);
    }
    // posición de las 12 categorías de comida en orden de carta
    for (let i = 0; i < CAT_ORDER.length; i++) {
      const id = CAT_ID[CAT_ORDER[i]];
      if (!DRY && id && !id.startsWith("<")) await tx.menuCategory.update({ where: { id }, data: { position: i + 1 } });
    }
    console.log(tag(`   ✎ posiciones de las ${CAT_ORDER.length} categorías (orden de carta)`));

    // 4) contador de posición por categoría (para nuevos/movidos)
    const posCounter: Record<string, number> = {};
    const nextPos = async (cat: string) => {
      if (posCounter[cat] == null) {
        const id = CAT_ID[cat];
        const agg = (!id || id.startsWith("<")) ? { _max: { position: null } } : await db.dish.aggregate({ where: { categoryId: id, active: true }, _max: { position: true } });
        posCounter[cat] = agg._max.position ?? 0;
      }
      return ++posCounter[cat];
    };

    // 5) PLAN
    console.log("\nPlatillos:");
    const createDish = async (r: Row) => {
      const catId = CAT_ID[r.cat];
      const exists = (!catId || catId.startsWith("<")) ? null : await db.dish.findFirst({ where: { name: r.name, categoryId: catId }, select: { id: true } });
      if (exists) { console.log(tag(`   ↩  NEW "${r.name}": ya existe`)); return; }
      const position = r.move ? await nextPos(r.cat) : null;
      plan.create++;
      if (DRY) { console.log(tag(`   ✚ NEW "${r.name}" $${r.price} → ${r.cat}${position != null ? ` pos=${position}` : ""}`)); return; }
      await tx.dish.create({ data: { name: r.name, description: r.desc ?? null, price: r.price, categoryId: catId, prepArea: COCINA, available: true, active: true, ...(position != null ? { position } : {}) } });
      console.log(`   ✚ NEW "${r.name}" $${r.price} → ${r.cat}${position != null ? ` pos=${position}` : ""}`);
    };
    const updateDish = async (r: Row, kind: string) => {
      const cur = await db.dish.findUnique({ where: { id: r.id! }, select: { name: true, price: true } });
      const position = r.move ? await nextPos(r.cat) : undefined;
      if (r.op === "AMBIG") plan.ambig++; else plan.update++;
      const label = `${kind} "${cur?.name}" $${Number(cur?.price)} → "${r.name}" $${r.price} [${r.cat}]`;
      if (DRY) { console.log(tag(`   ✎ ${label}`)); return; }
      await tx.dish.update({ where: { id: r.id! }, data: { name: r.name, price: r.price, prepArea: COCINA, active: true, archivedAt: null, categoryId: CAT_ID[r.cat], ...(r.desc !== undefined ? { description: r.desc } : {}), ...(position != null ? { position } : {}) } });
      console.log(`   ✎ ${label}`);
    };

    for (const r of PLAN) {
      if (r.op === "NEW") await createDish(r);
      else if (r.op === "UPDATE") await updateDish(r, "UPDATE");
      else if (r.op === "AMBIG") {
        if (r.decision === "NUEVO_ARCHIVA") {
          console.log(tag(`   ⇄ AMBIG "${r.name}" = NUEVO + ARCHIVA viejo`));
          await createDish({ ...r, op: "NEW" });
          const cur = await db.dish.findUnique({ where: { id: r.id! }, select: { name: true } });
          if (!DRY) await tx.dish.update({ where: { id: r.id! }, data: { active: false, archivedAt: new Date() } });
          plan.archiva++; console.log(tag(`   ▢ ARCHIVA "${cur?.name}"`));
        } else await updateDish(r, "AMBIG→ACT");
      }
    }

    // 6) Archivar
    console.log("\nArchivar (Especialidades del Chef + Bistecca + Carpaccio di Totoaba):");
    for (const a of ARCHIVE) {
      const cur = await db.dish.findUnique({ where: { id: a.id }, select: { name: true, active: true } });
      if (cur && !cur.active) { console.log(tag(`   ↩  "${a.label}": ya inactivo`)); continue; }
      plan.archiva++;
      if (DRY) { console.log(tag(`   ▢ ARCHIVA "${cur?.name ?? a.label}"`)); continue; }
      await tx.dish.update({ where: { id: a.id }, data: { active: false, archivedAt: new Date() } });
      console.log(`   ▢ ARCHIVA "${cur?.name ?? a.label}"`);
    }
  };

  if (DRY) {
    await run({} as Prisma.TransactionClient);
    console.log(`\n[DRY] Resumen: cat rename ${plan.rename} · cat nuevas ${plan.newcat} · UPDATE ${plan.update} · AMBIG ${plan.ambig} · NUEVO ${plan.create} · ARCHIVA ${plan.archiva}`);
    console.log("\nDRY_RUN=1 → NO se escribió nada. Revisa el bloque DECISIONES y vuelve a correr sin DRY_RUN.\n");
    return;
  }
  await prisma.$transaction(run, { timeout: 120_000, maxWait: 15_000 });
  console.log(`\nResumen: cat rename ${plan.rename} · cat nuevas ${plan.newcat} · UPDATE ${plan.update} · AMBIG ${plan.ambig} · NUEVO ${plan.create} · ARCHIVA ${plan.archiva}`);
  console.log("Listo.\n");
}

main()
  .catch((e) => { console.error("\nError en comida-carta-fusion-2026-09-11:", e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
