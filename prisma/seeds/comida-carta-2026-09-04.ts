import { prisma } from "../../lib/prisma";
import { TENANT, ACTIVE_STATUSES } from "../../lib/comanda";
import type { Prisma } from "@prisma/client";

/**
 * Reemplazo de la carta COMIDA (alimentos / COCINA) — 2026-09-04.
 *
 * Alcance: SOLO las 9 categorías COCINA que el .md toca (Antipasti, Paste, Pizza,
 * Risotto, Insalate, Carne Wagyu, Terra, Pesce Del Giorno, Especialidades del Chef).
 * NO toca Postres ni ninguna carta BARRA (Bebidas/Destilados/Vinos): position,
 * visible e isPrincipal de esas quedan intactas — este seed nunca las referencia.
 *
 * Idempotente. Corre TODO dentro de una transacción. Con DRY_RUN=1 imprime el plan
 * y NO escribe. Aborta si hay una CashSession OPEN o comandas activas.
 *
 * Correr (primero en seco):   DRY_RUN=1 npm run db:seed:comida-2026-09
 * Correr en firme:            npm run db:seed:comida-2026-09
 *
 * ── LEE EL BLOQUE `DECISIONES` ANTES DE CORRER EN FIRME ──────────────────────
 * Los AMBIGUO y los Cortes venían sin veredicto explícito; abajo van mis
 * RECOMENDACIONES (con nivel de confianza). "ACTUALIZA" conserva el dishId y el
 * histórico; "NUEVO_ARCHIVA" crea uno nuevo y archiva el viejo. Cambia el campo
 * `decision` de cualquier renglón si no coincide con tu criterio.
 */

const DRY = process.env.DRY_RUN === "1";
const COCINA = "COCINA" as const;

const CAT = {
  antipasti: "cmn96kb8s0000agj3468jhuxy",
  paste:     "cmn96kb8w0001agj3mlt293ea",
  pizza:     "cmn96kb8y0002agj37i5gzjg6",
  risotto:   "cmn96kb8z0003agj31yll7u7y",
  insalate:  "cmn96kb910004agj3gkccyhqj",
  wagyu:     "cmn96kb930005agj319dk0z6s",
  terra:     "cmn96kb950006agj3ls15jjd5",
  pesce:     "cmn96kb970007agj3wkhlf5vy",
  autor:     "cmq18yhl00000cbdihm3qgxss",
} as const;
type CatKey = keyof typeof CAT;
type Decision = "ACTUALIZA" | "NUEVO_ARCHIVA";

interface Row {
  op: "KEEP" | "UPDATE" | "NEW" | "AMBIG" | "CORTE";
  cat: CatKey;
  name: string;          // nombre final deseado (KEEP = nombre que ya tiene en DB)
  price: number;
  id?: string;           // requerido salvo NEW
  isExtra?: boolean;
  decision?: Decision;   // solo AMBIG / CORTE
  note?: string;
}

// ── PLAN ─────────────────────────────────────────────────────────────────────
const PLAN: Row[] = [
  // ANTIPASTI
  { op: "UPDATE", cat: "antipasti", id: "cmn96kbaw0013agj3k7ycg4dj", name: "Carpaccio di Manzo", price: 455, note: "rename quita 'Wagyu'" },
  { op: "KEEP",   cat: "antipasti", id: "cmn96kbaw0012agj3cz6w3aig", name: "Carpaccio di Salmone", price: 455 },
  { op: "UPDATE", cat: "antipasti", id: "cmn96kbaw0017agj3kkqdlqx3", name: "Carpaccio di Totoaba al Tartufo", price: 455 },
  { op: "UPDATE", cat: "antipasti", id: "cmn96kbaw0018agj3t0vqkqlw", name: "Polpo Baby Fritto", price: 455, note: "rename 'Polpo Fritti'" },
  { op: "UPDATE", cat: "antipasti", id: "cmn96kbaw0019agj3h5p5evcq", name: "Polpo Giovane Aglio e Olio", price: 455, note: "rename 'Polpo all Aglio e Olio'" },
  { op: "UPDATE", cat: "antipasti", id: "cmn96kbaw0011agj396x08ou9", name: "Polpo Giovane alla Griglia", price: 455, note: "rename 'Polpo alla Griglia'" },
  { op: "KEEP",   cat: "antipasti", id: "cmn96kbaw0016agj308hdh7iq", name: "Carpaccio di Polpo", price: 375 },
  { op: "UPDATE", cat: "antipasti", id: "cmn96kbaw001bagj3z7sjl8ic", name: "Cozze alla Marinara", price: 335 },
  { op: "KEEP",   cat: "antipasti", id: "cmn96kbaw001aagj3wf7sk81x", name: "Calamari Fritti", price: 275 },
  { op: "UPDATE", cat: "antipasti", id: "cmn96kbaw001cagj37vombq3p", name: "Bruschetta di Carciofi e Formaggio", price: 275, note: "rename 'Bruschette ai…'" },
  { op: "UPDATE", cat: "antipasti", id: "cmn96kbaw001hagj3wmxtsl46", name: "Asparagi Grigliati", price: 275 },
  { op: "UPDATE", cat: "antipasti", id: "cmn96kbaw001fagj320v3vs6r", name: "Bruschetta Classica", price: 235, note: "rename 'Bruschette Classiche'" },
  { op: "KEEP",   cat: "antipasti", id: "cmn96kbaw001gagj32u1bsso5", name: "Carciofo alla Brace", price: 235 },
  { op: "KEEP",   cat: "antipasti", id: "cmn96kbaw001eagj3y462ecx2", name: "Melanzane alla Parmigiana", price: 235 },
  { op: "KEEP",   cat: "antipasti", id: "cmn96kbaw001dagj3hgrgn5el", name: "Provola al Forno", price: 235 },

  // CARNE WAGYU (Cortes 200gr)
  { op: "NEW",   cat: "wagyu", name: "Filete", price: 870 },
  { op: "CORTE", cat: "wagyu", id: "cmn96kbbj002tagj3u0d96etj", name: "Rib Eye", price: 790, decision: "ACTUALIZA", note: "[Suposición] mismo corte, reprecio/porción 200g" },
  { op: "CORTE", cat: "wagyu", id: "cmn96kbbj002uagj36rm1tkx5", name: "New York", price: 750, decision: "ACTUALIZA", note: "[Suposición] mismo corte" },
  { op: "CORTE", cat: "wagyu", id: "cmn96kbbj002vagj3htt485xp", name: "Picaña", price: 550, decision: "ACTUALIZA", note: "[Suposición] rename 'Picanha' + reprecio" },
  { op: "NEW",   cat: "wagyu", name: "Flat Iron", price: 450 },
  { op: "NEW",   cat: "wagyu", name: "Tri-Tip", price: 430 },
  { op: "CORTE", cat: "wagyu", id: "cmn96kbbj002wagj3vgsea3il", name: "Arrachera", price: 390, decision: "ACTUALIZA", note: "[Suposición] mismo corte; distinto del 'Taco de Arrachera'" },

  // ESPECIALIDADES DEL CHEF (Autor) — Tacos, Hamburguesas, Acuario
  { op: "NEW",    cat: "autor", name: "Taco de Lengua", price: 199, note: ".md 'Lengua' (desambiguado)" },
  { op: "UPDATE", cat: "autor", id: "cmq18yhmi000mcbdidfdc36g8", name: "Taco de Suadero Confitado", price: 150, note: "rename 'Taco de Suadero (Wagyu) Confitado'" },
  { op: "NEW",    cat: "autor", name: "Taco de Gaonera de Diezmillo", price: 150 },
  { op: "NEW",    cat: "autor", name: "Taco de Arrachera", price: 150, note: ".md 'Arrachera' (desambiguado del corte)" },
  { op: "NEW",    cat: "autor", name: "Taco de Costilla del siete", price: 150 },
  // Hamburguesa: la Wagyu actual cuesta $330 = mismo precio que la s/queso del .md → [Probable] es la s/queso.
  { op: "AMBIG",  cat: "autor", id: "cmq18yhm9000ecbdighto54bj", name: "Hamburguesa s/queso", price: 330, decision: "ACTUALIZA", note: "[Probable] 'Hamburguesa de Wagyu' ($330)=s/queso — PENDIENTE confirmar con cocina" },
  { op: "NEW",    cat: "autor", name: "Hamburguesa c/queso", price: 390, note: "si la Wagyu era s/queso, esta es nueva — PENDIENTE cocina" },
  // Acuario > Enteros: precio por 100 GR (no por gramo: items/route.ts:56 topa la cantidad en 999).
  { op: "AMBIG",  cat: "autor", id: "cmq18yhle0002cbdi35gfyo3j", name: "Cola de Langosta Roja (100 GR)", price: 275, decision: "NUEVO_ARCHIVA", note: "[Probable] 'Langosta Roja Viva' ($990 entera) es producto distinto de la cola por peso" },
  { op: "NEW",    cat: "autor", name: "Pulpo Vulgaris (100 GR)", price: 255 },
  { op: "NEW",    cat: "autor", name: "King Kampachi (100 GR)", price: 150 },
  // Acuario > Crudos (130gr)
  { op: "NEW",    cat: "autor", name: "Crudo de Salmón Ora King", price: 390 },
  { op: "AMBIG",  cat: "autor", id: "cmq18yhlz000acbdi3c97k4f7", name: "Crudo de Atún Aleta Azul", price: 290, decision: "ACTUALIZA", note: "[Suposición] 'Sashimi de Atún' cabe bajo 'Crudos'; mismo pescado" },
  { op: "NEW",    cat: "autor", name: "Crudo de Totoaba", price: 230 },
  // Acuario > Conchas
  { op: "UPDATE", cat: "autor", id: "cmq18yhlt0006cbdimtsl42ko", name: "Ostiones Rockefeller", price: 590, note: "rename quita 'Media Docena'" },
  { op: "NEW",    cat: "autor", name: "Ostiones al natural", price: 390, note: ".md 'Al natural' (desambiguado)" },
  // Acuario > Tacos
  { op: "UPDATE", cat: "autor", id: "cmq18yhmg000kcbdi1kwvfxxs", name: "Taco de Jaiba Suave Frita", price: 175, note: "rename 'Taco de Jaiba'" },
  { op: "NEW",    cat: "autor", name: "Taco de Pulpo Zarandeado", price: 175 },
  // Acuario > Aguachiles
  { op: "UPDATE", cat: "autor", id: "cmq18yhmc000gcbdimac8dvh3", name: "Aguachile Tatemado", price: 295, note: "rename 'Aguachile Negro Tatemado'" },
  { op: "NEW",    cat: "autor", name: "Aguachile Verde", price: 295, note: ".md 'Verde' (desambiguado)" },

  // PIZZA (Especialidad $355 / Clásica $245)
  { op: "KEEP",   cat: "pizza", id: "cmn96kbb70022agj3fk795ytw", name: "Frutti di Mare (Pizza)", price: 355, note: "conservar sufijo" },
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb70027agj3f3mv0sqw", name: "Capricciosa", price: 355 },
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb70024agj3hb5128k5", name: "Diavola", price: 355 },
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb70026agj3l5p005s2", name: "Fichi e Prosciutto", price: 355, note: "bare (la ensalada lleva '(Ensalada)')" },
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb70025agj340isr6zd", name: "Francescana", price: 355 },
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb70023agj3fr3mscwm", name: "Gamberi", price: 355 },
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb70028agj3suavoy9z", name: "Medici", price: 355 },
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb8002dagj3z0pspfp5", name: "Mortadella e Pistacchio", price: 355 },
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb8002aagj3anlopzzl", name: "Bianca", price: 355 },
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb80029agj34s6sw23e", name: "Insaccati", price: 355 },
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb8002cagj3vwd4be05", name: "Pera e Gorgonzola", price: 355 },
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb8002bagj3l1ccrqw1", name: "Salsiccia e Pancetta", price: 355 },
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb8002eagj380kt2q53", name: "Margherita", price: 245 },
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb8002fagj35kck36r7", name: "Pepperoni", price: 245 },
  { op: "UPDATE", cat: "pizza", id: "cmn96kbb8002gagj3qk71hdby", name: "Regina", price: 245 },

  // RISOTTO
  { op: "UPDATE", cat: "risotto", id: "cmn96kbbc002hagj3kqtn68i5", name: "Risotto alla Milanese", price: 495 },
  { op: "UPDATE", cat: "risotto", id: "cmn96kbbc002jagj36u0pr3bv", name: "Risotto ai Frutti di Mare", price: 395 },
  { op: "UPDATE", cat: "risotto", id: "cmn96kbbc002iagj3cuoddajh", name: "Risotto al Tartufo", price: 375, note: "rename 'ai'→'al'" },
  { op: "KEEP",   cat: "risotto", id: "cmn96kbbc002kagj3y59952li", name: "Risotto ai Gamberi e Limone", price: 335 },

  // INSALATE
  { op: "UPDATE", cat: "insalate", id: "cmn96kbbh002magj3a9k5k4nm", name: "Insalata di Tonno", price: 335, note: "rename 'Insalate'→'Insalata'" },
  { op: "KEEP",   cat: "insalate", id: "cmn96kbbh002nagj3tb8y4q85", name: "Fichi e Prosciutto (Ensalada)", price: 295, note: "conservar sufijo" },
  { op: "UPDATE", cat: "insalate", id: "cmn96kbbh002qagj341lz0mhg", name: "Fragola Capra e Grana", price: 295, note: "rename (quita coma)" },
  { op: "KEEP",   cat: "insalate", id: "cmn96kbbh002oagj3hwhu7ulp", name: "Cestino di Parmigiano", price: 275 },
  { op: "UPDATE", cat: "insalate", id: "cmn96kbbh002sagj3hv4wt30z", name: "Mediterranea", price: 235 },
  { op: "UPDATE", cat: "insalate", id: "cmn96kbbh002ragj3d0wljsne", name: "Caprese", price: 235 },

  // TERRA
  { op: "NEW",    cat: "terra", name: "Bistecca alla Fiorentina", price: 3950, note: "1.4 kg aprox" },
  { op: "AMBIG",  cat: "terra", id: "cmn96kbbn002xagj31kjoksf0", name: "Filetto del Chef", price: 990, decision: "NUEVO_ARCHIVA", note: "[Suposición] salsa/descr. distinta de 'Filetto ai Funghi'" },
  { op: "UPDATE", cat: "terra", id: "cmn96kbbn002zagj3nuty5sq9", name: "Brasato al Vino Rosso", price: 590 },
  { op: "KEEP",   cat: "terra", id: "cmn96kbbn002yagj314mm2lew", name: "Costata del Nonno", price: 550 },
  { op: "AMBIG",  cat: "terra", id: "cmn96kbbn0030agj3ca0lnddc", name: "Scaloppine al Funghi Trifolati", price: 395, decision: "NUEVO_ARCHIVA", note: "[Suposición] nombre distinto de 'Scaloppine di Maria'" },
  { op: "KEEP",   cat: "terra", id: "cmn96kbbn0031agj3814epjt5", name: "Cotoletta alla Napoletana", price: 395 },
  { op: "UPDATE", cat: "terra", id: "cmn96kbbn0032agj3ijdz0yqu", name: "Petto di Pollo alla Boscaiola", price: 295 },

  // PESCE DEL GIORNO
  { op: "UPDATE", cat: "pesce", id: "cmn96kbbr0033agj337mg14il", name: "Salmone Ora King alla Rosina", price: 990 },
  { op: "UPDATE", cat: "pesce", id: "cmn96kbbr0034agj32w8i0qsn", name: "Totoaba alla Livornese", price: 790 },
  { op: "AMBIG",  cat: "pesce", id: "cmn96kbbr0035agj35u7p9shg", name: "Salmone all'Acqua Pazza", price: 650, decision: "NUEVO_ARCHIVA", note: "[Suposición] prep distinta de 'al Vino Bianco'" },
  { op: "AMBIG",  cat: "pesce", id: "cmn96kbbr0036agj3ny1b68zn", name: "Tonno Rosso", price: 650, decision: "NUEVO_ARCHIVA", note: "[Probable] corte distinto de 'Tagliata di Ventresca'" },
  { op: "AMBIG",  cat: "pesce", id: "cmn96kbbr0037agj3wae9fbzv", name: "Totoaba al Limone", price: 595, decision: "NUEVO_ARCHIVA", note: "[Seguro] pescado distinto de 'Spigola al Limone'" },

  // PASTE (Di Mare $355 / Fresca $295 / Classiche $275)
  { op: "UPDATE", cat: "paste", id: "cmn96kbb2001jagj3ks7poqh9", name: "Linguine Fra Diavola", price: 355 },
  { op: "NEW",    cat: "paste", name: "Linguine Allo Scoglio", price: 355 },
  { op: "AMBIG",  cat: "paste", id: "cmn96kbb2001magj3vyl3tje2", name: "Linguine Frutti di Mare", price: 355, decision: "ACTUALIZA", note: "[Probable] = 'Frutti di Mare (Pasta)'" },
  { op: "KEEP",   cat: "paste", id: "cmn96kbb2001lagj37xoax30t", name: "Fettuccine Mare e Monti", price: 355 },
  { op: "UPDATE", cat: "paste", id: "cmn96kbb2001kagj350kh8yqa", name: "Ravioli di Granchio Moro al Rosé", price: 355, note: "rename acento" },
  { op: "NEW",    cat: "paste", name: "Linguine alle Vongole", price: 355 },
  { op: "UPDATE", cat: "paste", id: "cmn96kbb2001qagj3uto0079s", name: "Farfalle al Salmone", price: 355 },
  { op: "UPDATE", cat: "paste", id: "cmn96kbb2001nagj3a2xbp1lp", name: "Lasagna", price: 295, note: "rename quita 'di Wagyu'" },
  { op: "UPDATE", cat: "paste", id: "cmn96kbb20020agj3p4vkll9c", name: "Ravioli ai Quattro Formaggi", price: 295 },
  { op: "UPDATE", cat: "paste", id: "cmn96kbb2001ragj3e8hw3vk3", name: "Cannelloni di Carne", price: 295, note: "rename 'Canelloni'" },
  { op: "UPDATE", cat: "paste", id: "cmn96kbb20021agj3xe4ju8bd", name: "Cannelloni di Ricotta", price: 295, note: "rename 'Canelloni'" },
  { op: "UPDATE", cat: "paste", id: "cmn96kbb2001tagj35epdqakl", name: "Gnocchi al Gorgonzola", price: 295 },
  { op: "KEEP",   cat: "paste", id: "cmn96kbb2001wagj3u15emgmb", name: "Penne Puttanesca", price: 275 },
  { op: "AMBIG",  cat: "paste", id: "cmn96kbb2001oagj3lrpptwlo", name: "Aglio, Olio e Peperoncino", price: 275, decision: "ACTUALIZA", note: "[Probable] misma pasta; la rueda pasa a extra +$50" },
  { op: "AMBIG",  cat: "paste", id: "cmn96kbb2001pagj3x5laplpj", name: "Alfredo", price: 275, decision: "ACTUALIZA", note: "[Probable] misma pasta; rueda→extra" },
  { op: "KEEP",   cat: "paste", id: "cmn96kbb2001vagj3qxhg0kax", name: "Spaghetti al Pesto Genovese", price: 275 },
  { op: "KEEP",   cat: "paste", id: "cmn96kbb2001uagj3wq8cji6n", name: "Fettuccine ai Quattro Formaggi", price: 275 },
  { op: "KEEP",   cat: "paste", id: "cmn96kbb2001xagj3jj1t8rpq", name: "Penne Arrabbiata", price: 275 },
  { op: "UPDATE", cat: "paste", id: "cmn96kbb2001yagj3syzz27wy", name: "Capellini al Tartufo", price: 275 },
  { op: "UPDATE", cat: "paste", id: "cmn96kbb2001zagj359gvk1vw", name: "Carbonara con Guanciale", price: 275 },
  { op: "UPDATE", cat: "paste", id: "cmn96kbb2001sagj3lqmny69f", name: "Spaghetti al Ragù", price: 275, note: "rename quita 'di Wagyu'" },

  // EXTRA — "pasta a la rueda" +$50 (isExtra, oculto del menú, lo pide el mesero)
  { op: "NEW", cat: "paste", name: "Rueda de Grana Padano", price: 50, isExtra: true, note: "extra +$50 para 'a la rueda'" },
];

// 13 platillos a ARCHIVAR (lista b aprobada). Archivar = active:false + archivedAt set (restaurable).
const ARCHIVE: { id: string; label: string }[] = [
  { id: "cmn96kbaw0014agj3gcvpen20", label: "Carpaccio di Tonno Aleta Blu" },
  { id: "cmt96pfo401as12gqq7p1jgmw", label: "Pátate al horno" },
  { id: "cmt2akp8f003exnwj9qonv9z4", label: "Tabla de quesos" },
  { id: "cmn96kbaw0015agj38wmobl1c", label: "Vitello Tonnato" },
  { id: "cmq18yhm4000ccbdiqd0kx81o", label: "Ceviche Peruano de Lubina Rallada" },
  { id: "cmq18yhlw0008cbditqkhdpxv", label: "Lengua de Wagyu en Salsa Verde" },
  { id: "cmq18yhme000icbdidwmplj3i", label: "Cream Chowder" },
  { id: "cmq18yhlp0004cbdin5bespyz", label: "Filete al Wellington estilo Gordon Ramsay" },
  { id: "cmrwe0zkt00037kk4qcidy6ht", label: "Almejas Chocolatas a la Parmesana" },
  { id: "cmrwe0zkd00017kk4kh5t7c7p", label: "Almejas Chocolatas Natural" },
  { id: "cmn96kbbh002pagj3b2dn78ic", label: "Arcobaleno" },
  { id: "cmn96kbb2001iagj3ri7uxav6", label: "Linguine Arrabiata con Aragosta Rossa" },
  { id: "cmn96kbbc002lagj3brnfnpr7", label: "Risotto al Grana Padano" },
];

// ── Ejecución ────────────────────────────────────────────────────────────────
const tag = (s: string) => `${DRY ? "[DRY] " : ""}${s}`;
const money = (n: number | Prisma.Decimal) => `$${Number(n)}`;

async function main() {
  console.log(`\n── Carta COMIDA 2026-09-04 ${DRY ? "(DRY_RUN: no escribe)" : "(EN FIRME)"} ──\n`);

  // 1) GUARD: no correr con caja abierta ni comandas activas.
  const openSession = await prisma.cashSession.findFirst({ where: { tenantId: TENANT, status: "OPEN" }, select: { folio: true } });
  if (openSession) throw new Error(`ABORTA: hay una CashSession OPEN (${openSession.folio}). Cierra el turno antes de sembrar.`);
  const activas = await prisma.comanda.count({ where: { tenantId: TENANT, status: { in: [...ACTIVE_STATUSES] } } });
  if (activas > 0) throw new Error(`ABORTA: hay ${activas} comanda(s) activa(s) (${ACTIVE_STATUSES.join("/")}). Cóbralas o ciérralas antes de sembrar.`);
  console.log("Guard OK: sin caja abierta, sin comandas activas.\n");

  // 2) Validación de todos los dishId del PLAN + ARCHIVE (lecturas).
  const idRows = [...PLAN.filter((r) => r.id), ...ARCHIVE.map((a) => ({ id: a.id, name: a.label, cat: undefined as CatKey | undefined }))] as { id: string; name: string; cat?: CatKey }[];
  const errs: string[] = [];
  for (const r of idRows) {
    const d = await prisma.dish.findUnique({ where: { id: r.id! }, select: { id: true, name: true, price: true, active: true, categoryId: true } });
    if (!d) { errs.push(`dishId no existe: ${r.name} (${r.id})`); continue; }
    if (r.cat && d.categoryId !== CAT[r.cat]) errs.push(`cat mismatch: ${r.name} (${r.id}) está en otra categoría`);
  }
  if (errs.length) { errs.forEach((e) => console.error("  ✗ " + e)); throw new Error("Validación falló: revisa los dishId del PLAN."); }
  console.log(`Validación OK: ${idRows.length} dishId existen.\n`);

  // 3) Posiciones: contador por categoría, arrancando tras el max actual de activos.
  const posCounter: Partial<Record<CatKey, number>> = {};
  for (const key of Object.keys(CAT) as CatKey[]) {
    const agg = await prisma.dish.aggregate({ where: { categoryId: CAT[key], active: true }, _max: { position: true } });
    posCounter[key] = agg._max.position ?? 0;
  }

  const plan = { keep: 0, update: 0, nuevo: 0, archiva: 0 };

  const run = async (tx: Prisma.TransactionClient) => {
    const db = DRY ? prisma : tx;

    const findByNameCat = (name: string, cat: CatKey) =>
      db.dish.findFirst({ where: { name, categoryId: CAT[cat] }, select: { id: true, active: true } });

    const createDish = async (r: Row) => {
      const exists = await findByNameCat(r.name, r.cat);
      if (exists) { console.log(tag(`   ↩  NEW "${r.name}": ya existe (${exists.id})`)); return; }
      const position = (posCounter[r.cat] = (posCounter[r.cat] ?? 0) + 1);
      plan.nuevo++;
      if (DRY) { console.log(tag(`   ✚ NEW "${r.name}" ${money(r.price)} → ${r.cat} pos=${position}${r.isExtra ? " isExtra" : ""}`)); return; }
      const created = await tx.dish.create({
        data: { name: r.name, price: r.price, categoryId: CAT[r.cat], prepArea: COCINA, position, available: true, active: true, isExtra: r.isExtra ?? false },
        select: { id: true },
      });
      console.log(`   ✚ NEW "${r.name}" ${money(r.price)} → ${r.cat} pos=${position} (${created.id})`);
    };

    const updateDish = async (r: Row) => {
      const cur = await db.dish.findUnique({ where: { id: r.id! }, select: { name: true, price: true, prepArea: true, active: true, archivedAt: true } });
      plan.update++;
      const change = `"${cur!.name}" ${money(cur!.price)} → "${r.name}" ${money(r.price)}`;
      if (DRY) { console.log(tag(`   ✎ UPDATE ${change}`)); return; }
      await tx.dish.update({ where: { id: r.id! }, data: { name: r.name, price: r.price, prepArea: COCINA, active: true, archivedAt: null } });
      console.log(`   ✎ UPDATE ${change}`);
    };

    const archiveId = async (id: string, label: string) => {
      const cur = await db.dish.findUnique({ where: { id }, select: { name: true, active: true } });
      if (cur && !cur.active) { console.log(tag(`   ↩  ARCHIVA "${label}": ya inactivo`)); return; }
      plan.archiva++;
      if (DRY) { console.log(tag(`   ▢ ARCHIVA "${cur?.name ?? label}"`)); return; }
      await tx.dish.update({ where: { id }, data: { active: false, archivedAt: new Date() } });
      console.log(`   ▢ ARCHIVA "${cur?.name ?? label}"`);
    };

    console.log("Aplicando PLAN…");
    for (const r of PLAN) {
      if (r.op === "KEEP") {
        plan.keep++;
        // aseguro prepArea COCINA por si viniera null (evita el 422 al comandar / verificación #2).
        if (!DRY) await tx.dish.update({ where: { id: r.id! }, data: { prepArea: COCINA, active: true, archivedAt: null } });
        console.log(tag(`   ═ KEEP "${r.name}" ${money(r.price)}`));
      } else if (r.op === "UPDATE") {
        await updateDish(r);
      } else if (r.op === "NEW") {
        await createDish(r);
      } else if (r.op === "AMBIG" || r.op === "CORTE") {
        if (r.decision === "NUEVO_ARCHIVA") {
          console.log(tag(`   ⇄ ${r.op} "${r.name}" = NUEVO + ARCHIVA viejo`));
          await createDish(r);
          await archiveId(r.id!, r.name);
        } else {
          await updateDish(r); // ACTUALIZA
        }
      }
    }

    console.log("\nArchivando lista (b)…");
    for (const a of ARCHIVE) await archiveId(a.id, a.label);
  };

  if (DRY) {
    await run({} as Prisma.TransactionClient); // en DRY, run() usa `prisma` para leer y no escribe
    console.log(`\n${tag("Resumen")}: KEEP ${plan.keep} · UPDATE ${plan.update} · NUEVO ${plan.nuevo} · ARCHIVA ${plan.archiva}`);
    console.log("\nDRY_RUN=1 → NO se escribió nada. Revisa el bloque DECISIONES y vuelve a correr sin DRY_RUN para aplicar.\n");
    return;
  }

  await prisma.$transaction(run, { timeout: 120_000, maxWait: 15_000 });
  console.log(`\nResumen: KEEP ${plan.keep} · UPDATE ${plan.update} · NUEVO ${plan.nuevo} · ARCHIVA ${plan.archiva}`);
  console.log("Listo. Verificaciones sugeridas en el mensaje del asistente (huérfanos, sin área, colisiones, ventas 30d).\n");
}

main()
  .catch((e) => { console.error("\nError en comida-carta-2026-09-04:", e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
