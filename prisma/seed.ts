import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Restaurants & Menus ────────────────────
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "san-luca" },
    update: {},
    create: {
      id: "rest_san_luca",
      name: "San Luca",
      slug: "san-luca",
      description: "Cocina de autor contemporánea",
    },
  });

  const menu = await prisma.menu.upsert({
    where: {
      restaurantId_slug: {
        restaurantId: restaurant.id,
        slug: "menu-principal",
      },
    },
    update: {},
    create: {
      id: "menu_principal",
      name: "Menú Principal",
      slug: "menu-principal",
      description: "Selección principal de temporada",
      displayOrder: 1,
      restaurantId: restaurant.id,
    },
  });

  console.log("✅ restaurant and menu seeded");

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
      where: { menuId_slug: { menuId: menu.id, slug: "entradas" } },
      update: { menuId: menu.id },
      create: {
        id: "cat_entradas",
        name: "Entradas",
        slug: "entradas",
        description: "Selección de entradas de temporada",
        order: 1,
        menuId: menu.id,
      },
    }),
    prisma.menuCategory.upsert({
      where: { menuId_slug: { menuId: menu.id, slug: "fuertes" } },
      update: { menuId: menu.id },
      create: {
        id: "cat_fuertes",
        name: "Platos Fuertes",
        slug: "fuertes",
        description: "Platos principales de la casa",
        order: 2,
        menuId: menu.id,
      },
    }),
    prisma.menuCategory.upsert({
      where: { menuId_slug: { menuId: menu.id, slug: "postres" } },
      update: { menuId: menu.id },
      create: {
        id: "cat_postres",
        name: "Postres",
        slug: "postres",
        description: "Postres artesanales",
        order: 3,
        menuId: menu.id,
      },
    }),
    prisma.menuCategory.upsert({
      where: { menuId_slug: { menuId: menu.id, slug: "bebidas" } },
      update: { menuId: menu.id },
      create: {
        id: "cat_bebidas",
        name: "Bebidas",
        slug: "bebidas",
        description: "Coctelería de autor y selección de vinos",
        order: 4,
        menuId: menu.id,
      },
    }),
  ]);

  console.log(`✅ ${categories.length} categories seeded`);

  const tags = await Promise.all([
    prisma.tag.upsert({ where: { slug: "spicy" }, update: {}, create: { name: "Spicy", slug: "spicy", color: "#D32F2F" } }),
    prisma.tag.upsert({ where: { slug: "vegan" }, update: {}, create: { name: "Vegan", slug: "vegan", color: "#2E7D32" } }),
    prisma.tag.upsert({ where: { slug: "gluten-free" }, update: {}, create: { name: "Gluten Free", slug: "gluten-free", color: "#1565C0" } }),
    prisma.tag.upsert({ where: { slug: "signature" }, update: {}, create: { name: "Signature", slug: "signature", color: "#6A1B9A" } }),
  ]);

  const tagBySlug = Object.fromEntries(tags.map((tag) => [tag.slug, tag.id]));

  // ── Menu Items ─────────────────────────────
  const items = [
    {
      id: "item_carpaccio",
      name: "Carpaccio de Res",
      description: "Res premium con alcaparras, parmesano y aceite de trufa",
      price: 285,
      categoryId: "cat_entradas",
      isFeatured: true,
      allergens: ["lácteos"],
      order: 1,
      imageUrl: "/images/menu/carpaccio.jpg",
      tags: ["signature", "gluten-free"],
    },
    {
      id: "item_ceviche",
      name: "Ceviche Nikkei",
      description: "Pescado del día con leche de tigre, ají amarillo y aguacate",
      price: 320,
      categoryId: "cat_entradas",
      isFeatured: true,
      allergens: ["mariscos"],
      order: 2,
      tags: ["spicy", "gluten-free"],
    },
    {
      id: "item_fondant",
      name: "Fondant de Chocolate",
      description: "Chocolate belga 70% con helado de vainilla de Madagascar",
      price: 220,
      categoryId: "cat_postres",
      isFeatured: true,
      allergens: ["gluten", "lácteos", "huevo"],
      order: 1,
      tags: ["signature"],
    },
  ];

  for (const item of items) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        description: item.description,
        price: item.price,
        categoryId: item.categoryId,
        isFeatured: item.isFeatured,
        allergens: item.allergens,
        order: item.order,
        imageUrl: item.imageUrl,
      },
      create: {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        categoryId: item.categoryId,
        isFeatured: item.isFeatured,
        allergens: item.allergens,
        order: item.order,
        imageUrl: item.imageUrl,
      },
    });

    await prisma.dishImage.upsert({
      where: { id: `${item.id}_img_1` },
      update: { imageUrl: item.imageUrl ?? "", displayOrder: 1 },
      create: {
        id: `${item.id}_img_1`,
        menuItemId: item.id,
        imageUrl: item.imageUrl ?? "",
        displayOrder: 1,
      },
    });

    await prisma.menuItemTag.deleteMany({ where: { menuItemId: item.id } });
    if (item.tags.length > 0) {
      await prisma.menuItemTag.createMany({
        data: item.tags.map((slug) => ({ menuItemId: item.id, tagId: tagBySlug[slug] })),
      });
    }
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
