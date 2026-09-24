import { prisma } from "../../lib/prisma";
import { TENANT, ACTIVE_STATUSES } from "../../lib/comanda";
import type { Prisma } from "@prisma/client";
import type { OptionChoice, OptionGroup } from "../../lib/dishOptions";

/**
 * Carta BRUNCH mexicana con opciones por platillo (Fase Brunch B-2) — 2026-09-24.
 *
 * Reemplazo casi total de la carta BRUNCH de alimentos (turno BRUNCH, carta "Brunch",
 * clase COCINA). La carta italiana anterior queda ARCHIVADA (active:false + archivedAt);
 * las 3 categorías nuevas (Antojitos, Huevos, Dulces) se crean/reusan; las 5 categorías
 * viejas se quedan vacías (NO se borran). No toca la carta "Bebidas" (BARRA) ni COMIDA.
 *
 * RESOLUCIÓN POR NOMBRE (no por dishId): los platillos tienen cuid() distinto en cada
 * base (local vs prod), así que hardcodear ids falla en prod. La carta se resuelve por
 * (turno=BRUNCH, name="Brunch") — único por @@unique([turno, name]) — y cada platillo
 * por su nombre dentro de esa carta, ignorando `active` (rama de reactivación). Con eso
 * el seed corre en cualquier base y es idempotente (re-aplicar el estado destino es no-op).
 *
 * ARCHIVADO POR EXCLUSIÓN: todo lo que quede vivo en la carta Brunch y NO sea uno de los
 * platillos nuevos se archiva. Así desaparecen los ~34 platillos italianos, "Chilaquiles
 * negros" y "Pepito di arrachera" sin depender de sus nombres exactos.
 *
 * Las OPCIONES (grupos Salsa / Estilo / Extra / Agrega proteína) y sus etiquetas se copian
 * LETRA POR LETRA de .raw/menu_san_luca_brunch.md. El precio de cada opción sale del grupo;
 * `desc` es solo texto de carta (no entra en cobro; ver lib/dishOptions.ts).
 *
 * Idempotente. Todo en una transacción. DRY_RUN=1 imprime el plan sin escribir.
 * Aborta si hay CashSession OPEN o comandas activas.
 *
 * DRY:   DRY_RUN=1 npm run db:seed:brunch-2026-09
 * FIRME: npm run db:seed:brunch-2026-09
 */

const DRY = process.env.DRY_RUN === "1";
const COCINA = "COCINA" as const;
const CARTA_TURNO = "BRUNCH" as const;
const CARTA_NAME = "Brunch";

// ── Grupos de opciones (etiquetas y precios LETRA POR LETRA del .raw) ──

const SALSAS: OptionChoice[] = ["Puya", "Pasilla", "Árbol", "Guajillo", "Chiltepín", "Morita", "Serrano", "Mulato", "7 Chiles"].map(
  (label) => ({ label }),
);
const SALSA_GROUP: OptionGroup = { group: "Salsa", required: true, max: 1, choices: SALSAS };

// Dos grupos separados como en el .raw: los 13 cortes (max 1) y los 3 extras (max 3).
// 130 g va en el nombre del grupo de cortes.
const CORTES_GROUP: OptionGroup = {
  group: "Agrega proteína (130 g)",
  required: false,
  max: 1,
  desc: "Cross Wagyu Americano",
  choices: [
    { label: "Filete", price: 355 },
    { label: "Rib Eye", price: 315 },
    { label: "New York", price: 275 },
    { label: "Picaña", price: 199 },
    { label: "Lengua", price: 199 },
    { label: "Brisket Ahumado", price: 155 },
    { label: "Flat Iron", price: 155 },
    { label: "Short Rib Ahumado", price: 135 },
    { label: "Tri-Tip", price: 135 },
    { label: "Suadero Confitado", price: 115 },
    { label: "Chambarete", price: 115 },
    { label: "Diezmillo", price: 99 },
    { label: "Arrachera", price: 99 },
  ],
};

const EXTRAS_GROUP: OptionGroup = {
  group: "Extras",
  required: false,
  max: 3,
  choices: [
    { label: "Huevo extra", price: 20 },
    { label: "Pechuga asada", price: 55 },
    { label: "Pechuga empanizada", price: 75 },
  ],
};

const HUEVOS_ESTILO: OptionGroup = {
  group: "Estilo",
  required: true,
  max: 1,
  choices: [
    { label: "Rancheros", desc: "Tortilla nixtamalizada, frijoles refritos y salsa roja." },
    { label: "Divorciados", desc: "Tortilla nixtamalizada, frijoles refritos, salsa roja y verde." },
    { label: "Omelet de la Huerta", desc: "Cuitlacoche, flor de calabaza y hongos." },
    { label: "A la Mexicana", desc: "Huevo revuelto, jitomate, cebolla y chile." },
  ],
};

const DULCES_ESTILO: OptionGroup = {
  group: "Estilo",
  required: true,
  max: 1,
  choices: [
    { label: "Fruta de temporada", desc: "Granola, yogurt y miel." },
    { label: "Pan Francés Clásico", desc: "Frutos rojos." },
    { label: "Crepas de Cajeta" },
    { label: "Hot Cakes de Nutella y Plátano" },
  ],
};

const DULCES_EXTRA: OptionGroup = { group: "Extra", required: false, max: 1, choices: [{ label: "Helado del día", price: 75 }] };

// ── Platillos destino ──

type CatKey = "Antojitos" | "Huevos" | "Dulces";
interface Row {
  cat: CatKey;
  name: string;
  price: number;
  desc: string | null;
  options: OptionGroup[];
}

// SALADOS (Antojitos + Huevos) llevan los grupos de cortes y extras; los Dulces no.
const PLAN: Row[] = [
  { cat: "Antojitos", name: "Chilaquiles", price: 135, desc: "Totopos nixtamalizados, crema, queso, cebolla y frijoles.", options: [SALSA_GROUP, CORTES_GROUP, EXTRAS_GROUP] },
  { cat: "Antojitos", name: "Enchiladas de nada", price: 99, desc: "3 piezas · Salsa, crema, queso y cebolla.", options: [SALSA_GROUP, CORTES_GROUP, EXTRAS_GROUP] },
  { cat: "Antojitos", name: "Enfrijoladas", price: 99, desc: "3 piezas · Tortillas nixtamalizadas bañadas en frijol, crema, queso y cebolla.", options: [CORTES_GROUP, EXTRAS_GROUP] },
  { cat: "Antojitos", name: "Sope", price: 55, desc: "1 pieza · Tortilla nixtamalizada bañada en frijol, crema, queso y cebolla.", options: [CORTES_GROUP, EXTRAS_GROUP] },
  { cat: "Antojitos", name: "Gordita de requesón", price: 55, desc: "1 pieza · Gordita de maíz con requesón, frijol y guacamole.", options: [CORTES_GROUP, EXTRAS_GROUP] },
  { cat: "Antojitos", name: "Huarache", price: 75, desc: "1 pieza · Tortilla de maíz alargada, frijoles, queso, crema y cebolla.", options: [CORTES_GROUP, EXTRAS_GROUP] },
  { cat: "Antojitos", name: "Quesadilla", price: 39, desc: null, options: [CORTES_GROUP, EXTRAS_GROUP] },
  { cat: "Antojitos", name: "Guacamole", price: 77, desc: null, options: [CORTES_GROUP, EXTRAS_GROUP] },
  { cat: "Antojitos", name: "Pepitos", price: 99, desc: "Baguet artesanal, frijoles, guacamole, queso Oaxaca y cebolla confitada.", options: [CORTES_GROUP, EXTRAS_GROUP] },
  { cat: "Huevos", name: "Huevos", price: 135, desc: null, options: [HUEVOS_ESTILO, CORTES_GROUP, EXTRAS_GROUP] },
  { cat: "Dulces", name: "Dulces", price: 135, desc: null, options: [DULCES_ESTILO, DULCES_EXTRA] },
];

const CAT_ORDER: CatKey[] = ["Antojitos", "Huevos", "Dulces"];
const tag = (s: string) => `${DRY ? "[DRY] " : ""}${s}`;
const asJson = (g: OptionGroup[]) => g as unknown as Prisma.InputJsonValue;

async function main() {
  console.log(`\n── Carta BRUNCH mexicana 2026-09-24 ${DRY ? "(DRY_RUN: no escribe)" : "(EN FIRME)"} ──\n`);

  // 1) GUARD
  const openSession = await prisma.cashSession.findFirst({ where: { tenantId: TENANT, status: "OPEN" }, select: { folio: true } });
  if (openSession) throw new Error(`ABORTA: CashSession OPEN (${openSession.folio}). Cierra el turno antes de sembrar.`);
  const activas = await prisma.comanda.count({ where: { tenantId: TENANT, status: { in: [...ACTIVE_STATUSES] } } });
  if (activas > 0) throw new Error(`ABORTA: ${activas} comanda(s) activa(s). Cóbralas o ciérralas antes de sembrar.`);
  console.log("Guard OK: sin caja abierta, sin comandas activas.\n");

  // 2) Resolver la carta destino (única por turno+nombre) y sus categorías.
  const carta = await prisma.carta.findFirst({
    where: { turno: CARTA_TURNO, name: CARTA_NAME },
    select: { id: true, clase: true, categories: { select: { id: true, name: true, position: true } } },
  });
  if (!carta) throw new Error(`ABORTA: no existe la carta ${CARTA_TURNO}/"${CARTA_NAME}". Revisa el menú antes de sembrar.`);
  if (carta.clase !== COCINA) throw new Error(`ABORTA: la carta ${CARTA_TURNO}/"${CARTA_NAME}" no es COCINA (es ${carta.clase}).`);
  const cartaCatIds = carta.categories.map((c) => c.id);
  console.log(`Carta destino: ${CARTA_TURNO}/"${CARTA_NAME}" (${carta.id}) · ${carta.categories.length} categorías existentes.\n`);

  const plan = { newcat: 0, create: 0, update: 0, archiva: 0, oculta: 0 };

  const run = async (tx: Prisma.TransactionClient) => {
    const db = DRY ? prisma : tx;

    // 3) Categorías nuevas: create-or-find. Van AL FRENTE (Antojitos=1, Huevos=2,
    // Dulces=3); las 5 viejas NO se reacomodan (quedan con su posición y se ocultan
    // en el paso 6 al quedar vacías).
    console.log("Categorías:");
    const catId: Record<CatKey, string> = { Antojitos: "", Huevos: "", Dulces: "" };
    for (let i = 0; i < CAT_ORDER.length; i++) {
      const nm = CAT_ORDER[i];
      const position = i + 1;
      const existing = carta.categories.find((c) => c.name === nm)
        ?? (await db.menuCategory.findFirst({ where: { name: nm, cartaId: carta.id }, select: { id: true } }));
      if (existing) {
        catId[nm] = existing.id;
        if (!cartaCatIds.includes(existing.id)) cartaCatIds.push(existing.id);
        if (!DRY) await tx.menuCategory.update({ where: { id: existing.id }, data: { visible: true, position } });
        console.log(tag(`   ↩  categoría "${nm}": ya existe (pos=${position})`));
        continue;
      }
      plan.newcat++;
      if (DRY) { catId[nm] = `<nueva:${nm}>`; console.log(tag(`   ✚ crear categoría "${nm}" pos=${position}`)); continue; }
      const c = await tx.menuCategory.create({ data: { name: nm, cartaId: carta.id, visible: true, position }, select: { id: true } });
      catId[nm] = c.id;
      cartaCatIds.push(c.id);
      console.log(`   ✚ categoría "${nm}" creada (${c.id}) pos=${position}`);
    }

    // 4) Platillos: resolver por nombre dentro de la carta (ignorando active y categoría),
    // rama de reactivación. 0 → crea; 1 → actualiza/mueve/reactiva; >1 → aborta (ambiguo).
    console.log("\nPlatillos:");
    const touched = new Set<string>();
    const posCounter: Record<CatKey, number> = { Antojitos: 0, Huevos: 0, Dulces: 0 };
    for (const r of PLAN) {
      const targetCat = catId[r.cat];
      const position = ++posCounter[r.cat];
      const matches = await db.dish.findMany({ where: { name: r.name, categoryId: { in: cartaCatIds } }, select: { id: true, name: true, active: true, archivedAt: true } });
      if (matches.length > 1) throw new Error(`AMBIG: "${r.name}" aparece ${matches.length} veces en la carta Brunch. Resuélvelo a mano antes de sembrar.`);
      const cur = matches[0];
      const data = {
        name: r.name,
        description: r.desc,
        price: r.price,
        categoryId: targetCat,
        prepArea: COCINA,
        options: asJson(r.options),
        available: true,
        active: true,
        archivedAt: null,
        position,
      };
      if (!cur) {
        plan.create++;
        if (!DRY && !targetCat.startsWith("<")) {
          const created = await tx.dish.create({ data, select: { id: true } });
          touched.add(created.id);
        }
        console.log(tag(`   ✚ NEW "${r.name}" $${r.price} → ${r.cat} pos=${position} · opciones: ${r.options.map((g) => `${g.group}[${g.choices.length}]`).join(", ")}`));
        continue;
      }
      plan.update++;
      const reactiva = cur.active === false ? " (reactiva)" : "";
      if (!DRY) {
        await tx.dish.update({ where: { id: cur.id }, data });
        touched.add(cur.id);
      }
      console.log(tag(`   ✎ UPDATE "${cur.name}" $${r.price} → ${r.cat} pos=${position}${reactiva} · opciones: ${r.options.map((g) => `${g.group}[${g.choices.length}]`).join(", ")}`));
    }

    // 5) Archivar por exclusión: todo lo VIVO en la carta que no sea de los nuevos.
    // En DRY no hay ids "touched" (no se escribió), así que se excluye por nombre destino.
    console.log("\nArchivar (todo lo que queda de la carta italiana anterior):");
    const planNames = new Set(PLAN.map((r) => r.name));
    const vivos = await db.dish.findMany({ where: { categoryId: { in: cartaCatIds }, active: true }, select: { id: true, name: true, categoryId: true } });
    const keptByCat = new Map<string, number>(); // platillos que QUEDAN activos por categoría
    for (const d of vivos) {
      const isNuevo = DRY ? planNames.has(d.name) : touched.has(d.id);
      if (isNuevo) { keptByCat.set(d.categoryId, (keptByCat.get(d.categoryId) ?? 0) + 1); continue; }
      plan.archiva++;
      if (!DRY) await tx.dish.update({ where: { id: d.id }, data: { active: false, archivedAt: new Date() } });
      console.log(tag(`   ▢ ARCHIVA "${d.name}"`));
    }

    // 6) Ocultar categorías que queden vacías. El menú público lista TODA categoría
    // visible sin comprobar si tiene platillos, así que las 5 italianas saldrían como
    // secciones vacías. Solo las EXISTENTES pueden vaciarse (las 3 nuevas siempre traen
    // platillos). OJO: si luego alguien restaura un platillo italiano desde el admin,
    // tendrá que volver a marcar su categoría como visible a mano.
    console.log("\nOcultar categorías vacías:");
    for (const c of carta.categories) {
      if ((keptByCat.get(c.id) ?? 0) > 0) continue;
      plan.oculta++;
      if (!DRY) await tx.menuCategory.update({ where: { id: c.id }, data: { visible: false } });
      console.log(tag(`   ▣ OCULTA "${c.name}"`));
    }
  };

  if (DRY) {
    await run({} as Prisma.TransactionClient);
    console.log(`\n[DRY] Resumen: cat nuevas ${plan.newcat} · NUEVO ${plan.create} · UPDATE ${plan.update} · ARCHIVA ${plan.archiva} · OCULTA ${plan.oculta}`);
    console.log("\nDRY_RUN=1 → NO se escribió nada.\n");
    return;
  }
  await prisma.$transaction(run, { timeout: 120_000, maxWait: 15_000 });
  console.log(`\nResumen: cat nuevas ${plan.newcat} · NUEVO ${plan.create} · UPDATE ${plan.update} · ARCHIVA ${plan.archiva} · OCULTA ${plan.oculta}`);
  console.log("Listo.\n");
}

main()
  .catch((e) => { console.error("\nError en brunch-carta-2026-09-24:", e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
