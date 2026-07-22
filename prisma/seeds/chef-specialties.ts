import { prisma } from "../../lib/prisma";

/**
 * Seed de la categoría "Especialidades del Chef" + 11 platillos.
 * Idempotente:
 *   - Si la categoría no existe, la crea con position 100 (al final del menú).
 *   - Por cada platillo, si ya existe uno con el mismo `name` dentro de la
 *     categoría, NO lo modifica (los platillos no se tocan si ya están).
 *
 * Categoría sin sufijo "(Brunch)" → se trata como comida regular (tarde).
 * Para clasificar como COCINA en prepArea, correr después:
 *   npm run db:seed:prep-area
 * (Ninguno contiene keywords de BARRA, así que cae naturalmente a COCINA.)
 *
 * Correr: npm run db:seed:chef
 */

const CATEGORY_NAME = "Especialidades del Chef";
const CATEGORY_POSITION = 100;

interface ChefDish {
  name: string;
  description: string;
  price: number;
}

// Orden = posición dentro de la categoría (1..11).
const DISHES: ChefDish[] = [
  {
    name: "Langosta Roja Viva de Ensenada",
    description:
      "Precio según tamaño. Pregunta a tu mesero por la receta del día.",
    price: 3, // $3 por gramo — el total depende del tamaño de la pieza (priceUnit "por gramo" en la card)
  },
  {
    name: "Filete al Wellington estilo Gordon Ramsay",
    description:
      "Corte de cross Wagyu americano, envuelto en duxelle de hongos y hojaldre artesanal, con base de salsa de gorgonzola y espárragos asados.",
    price: 990,
  },
  {
    name: "Ostiones Rockefeller Media Docena",
    description:
      "Ostiones del Golfo de México, preparados con una exquisita crema de espinaca, mezcla de quesos y planchetas horneados a la leña.",
    price: 595,
  },
  {
    name: "Lengua de Wagyu en Salsa Verde",
    description:
      "Tierna lengua de Wagyu cocida lentamente y bañada en una salsa verde casera de tomatillo y chile serrano.",
    price: 590,
  },
  {
    name: "Sashimi de Atún Aleta Azul",
    description:
      "Atún de aleta azul (Bluefin) del Atlántico, servido en cortes precisos con salsa nikkei, aguacate y cilantro fresco.",
    price: 395,
  },
  {
    name: "Ceviche Peruano de Lubina Rallada",
    description:
      "Inspirado en la costa norte del Perú, elaborado con lubina rallada de pesca sustentable, leche de tigre y ají amarillo.",
    price: 395,
  },
  {
    name: "Hamburguesa de Wagyu",
    description:
      "Carne 100% Wagyu americano, jugosa y marmoleada, servida en pan de masa madre.",
    price: 330,
  },
  {
    name: "Aguachile Negro Tatemado",
    description:
      "Reinterpretación del clásico sinaloense, preparado con chiles secos tatemados y notas ahumadas.",
    price: 275,
  },
  {
    name: "Cream Chowder",
    description:
      "Receta tradicional de Nueva Inglaterra, preparada con almejas frescas del Pacífico y papas cremosas, servida en pan artesanal.",
    price: 245,
  },
  {
    name: "Taco de Jaiba",
    description:
      "Jaiba azul del Pacífico cocinada lentamente, servida con mayonesa negra, perejil frito y aguacate en tortilla de maíz nixtamalizado.",
    price: 185,
  },
  {
    name: "Taco de Suadero (Wagyu) Confitado",
    description:
      "Suadero de Wagyu cocido a la leña durante 12 horas, servido en tortilla de maíz con cebolla, cilantro y salsa tatemada.",
    price: 175,
  },
  {
    name: "Almejas Chocolatas Natural",
    description: "",
    price: 90,
  },
  {
    name: "Almejas Chocolatas a la Parmesana",
    description: "",
    price: 125,
  },
];

async function main() {
  console.log(`\n── Seed "${CATEGORY_NAME}" — ${DISHES.length} platillos ──`);

  // 1. Upsert de la categoría (busca por name; crea si no existe).
  let category = await prisma.menuCategory.findFirst({
    where: { name: CATEGORY_NAME },
    select: { id: true, name: true, position: true },
  });

  if (!category) {
    category = await prisma.menuCategory.create({
      data: { name: CATEGORY_NAME, position: CATEGORY_POSITION },
      select: { id: true, name: true, position: true },
    });
    console.log(`✅ Categoría creada: "${category.name}" (id=${category.id}, position=${category.position})`);
  } else {
    console.log(`↩  Categoría ya existe: "${category.name}" (id=${category.id})`);
  }

  // 2. Por cada platillo: crea solo si no existe uno con el mismo name en la categoría.
  let created = 0;
  let skipped = 0;
  for (let i = 0; i < DISHES.length; i++) {
    const d = DISHES[i];
    const existing = await prisma.dish.findFirst({
      where: { name: d.name, categoryId: category.id },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.dish.create({
      data: {
        name: d.name,
        description: d.description,
        price: d.price,
        categoryId: category.id,
        position: i + 1,
        available: true,
        // prepArea queda NULL aquí; lo asigna `dishes-prepArea` por keyword de categoría.
      },
    });
    created++;
  }

  console.log(`✅ Platillos: ${created} nuevos, ${skipped} ya existían`);
  console.log(
    `\nSiguiente paso (clasificar prepArea de los nuevos como COCINA):\n  npm run db:seed:prep-area\n`,
  );
}

main()
  .catch((e) => {
    console.error("Error en seed chef-specialties:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
