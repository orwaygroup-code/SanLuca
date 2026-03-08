import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Locations ──────────────────────────────
  const locations = await Promise.all([
    prisma.location.upsert({
      where: { id: "loc_centro" },
      update: {},
      create: {
        id: "loc_centro",
        name: "Centro Histórico",
        address: "Av. Reforma 234, Col. Centro, CDMX",
        phone: "+52 55 1234 5678",
        whatsapp: "5215512345678",
        mapUrl: "https://maps.google.com/?q=19.4326,-99.1332",
        order: 1,
      },
    }),
    prisma.location.upsert({
      where: { id: "loc_polanco" },
      update: {},
      create: {
        id: "loc_polanco",
        name: "Polanco",
        address: "Av. Presidente Masaryk 311, Polanco, CDMX",
        phone: "+52 55 8765 4321",
        whatsapp: "5215587654321",
        mapUrl: "https://maps.google.com/?q=19.4333,-99.1944",
        order: 2,
      },
    }),
    prisma.location.upsert({
      where: { id: "loc_roma" },
      update: {},
      create: {
        id: "loc_roma",
        name: "Roma Norte",
        address: "Calle Orizaba 87, Roma Norte, CDMX",
        phone: "+52 55 2468 1357",
        whatsapp: "5215524681357",
        mapUrl: "https://maps.google.com/?q=19.4194,-99.1617",
        order: 3,
      },
    }),
  ]);

  console.log(`✅ ${locations.length} locations seeded`);

  // ── Menu Categories ────────────────────────
  const categories = await Promise.all([
    prisma.menuCategory.upsert({
      where: { slug: "entradas" },
      update: {},
      create: {
        id: "cat_entradas",
        name: "Entradas",
        slug: "entradas",
        description: "Selección de entradas de temporada",
        order: 1,
      },
    }),
    prisma.menuCategory.upsert({
      where: { slug: "fuertes" },
      update: {},
      create: {
        id: "cat_fuertes",
        name: "Platos Fuertes",
        slug: "fuertes",
        description: "Platos principales de la casa",
        order: 2,
      },
    }),
    prisma.menuCategory.upsert({
      where: { slug: "postres" },
      update: {},
      create: {
        id: "cat_postres",
        name: "Postres",
        slug: "postres",
        description: "Postres artesanales",
        order: 3,
      },
    }),
    prisma.menuCategory.upsert({
      where: { slug: "bebidas" },
      update: {},
      create: {
        id: "cat_bebidas",
        name: "Bebidas",
        slug: "bebidas",
        description: "Coctelería de autor y selección de vinos",
        order: 4,
      },
    }),
  ]);

  console.log(`✅ ${categories.length} categories seeded`);

  // ── Menu Items ─────────────────────────────
  const items = [
    // Entradas
    {
      name: "Carpaccio de Res",
      description: "Res premium con alcaparras, parmesano y aceite de trufa",
      price: 285,
      categoryId: "cat_entradas",
      isFeatured: true,
      allergens: ["lácteos"],
      order: 1,
    },
    {
      name: "Ceviche Nikkei",
      description: "Pescado del día con leche de tigre, ají amarillo y aguacate",
      price: 320,
      categoryId: "cat_entradas",
      isFeatured: true,
      allergens: ["mariscos"],
      order: 2,
    },
    {
      name: "Ensalada de Burrata",
      description: "Burrata fresca con jitomates heirloom y pesto de albahaca",
      price: 265,
      categoryId: "cat_entradas",
      allergens: ["lácteos"],
      order: 3,
    },
    // Fuertes
    {
      name: "Rib Eye 400g",
      description: "Corte prime con papa trufada y vegetales asados",
      price: 780,
      categoryId: "cat_fuertes",
      isFeatured: true,
      allergens: ["lácteos"],
      order: 1,
    },
    {
      name: "Salmón en Costra de Hierbas",
      description: "Salmón atlántico con risotto de espárragos",
      price: 520,
      categoryId: "cat_fuertes",
      allergens: ["mariscos", "lácteos"],
      order: 2,
    },
    {
      name: "Pasta al Tartufo",
      description: "Tagliatelle fresca con crema de trufa negra y parmesano",
      price: 450,
      categoryId: "cat_fuertes",
      isFeatured: true,
      allergens: ["gluten", "lácteos"],
      order: 3,
    },
    {
      name: "Cordero Braseado",
      description: "Pierna de cordero con puré de camote y reducción de vino tinto",
      price: 680,
      categoryId: "cat_fuertes",
      allergens: [],
      order: 4,
    },
    // Postres
    {
      name: "Fondant de Chocolate",
      description: "Chocolate belga 70% con helado de vainilla de Madagascar",
      price: 220,
      categoryId: "cat_postres",
      isFeatured: true,
      allergens: ["gluten", "lácteos", "huevo"],
      order: 1,
    },
    {
      name: "Crème Brûlée",
      description: "Clásica con toque de lavanda",
      price: 195,
      categoryId: "cat_postres",
      allergens: ["lácteos", "huevo"],
      order: 2,
    },
    {
      name: "Tiramisú",
      description: "Receta tradicional italiana con mascarpone y café espresso",
      price: 210,
      categoryId: "cat_postres",
      allergens: ["gluten", "lácteos", "huevo"],
      order: 3,
    },
    // Bebidas
    {
      name: "Old Fashioned de la Casa",
      description: "Bourbon, bitter artesanal, naranja y cereza",
      price: 240,
      categoryId: "cat_bebidas",
      isFeatured: true,
      allergens: [],
      order: 1,
    },
    {
      name: "Mezcal Sour",
      description: "Mezcal joven, limón, jarabe de agave y clara de huevo",
      price: 220,
      categoryId: "cat_bebidas",
      allergens: ["huevo"],
      order: 2,
    },
    {
      name: "Copa de Vino Tinto",
      description: "Selección rotativa del sommelier",
      price: 180,
      categoryId: "cat_bebidas",
      allergens: [],
      order: 3,
    },
  ];

  for (const item of items) {
    await prisma.menuItem.create({ data: item });
  }

  console.log(`✅ ${items.length} menu items seeded`);
  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
