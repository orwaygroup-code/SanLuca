import { prisma } from "./prisma";
import type { ContactFormData } from "@/types/forms";
import { COMIDA_GROUPS, BRUNCH_GROUPS } from "@/config/Menustructure";

// ============================================
// MENU
// ============================================

export async function getMenuCategories() {
  return prisma.menuCategory.findMany({
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      position: true,
      createdAt: true,
      dishes: {
        where: { available: true },
        orderBy: { position: "asc" },
      },
    },
  });
}

/**
 * Menú para el STAFF (comandero): incluye los platillos visibles del menú
 * (available) MÁS los "extras" (isExtra), que están ocultos del menú público
 * pero los meseros deben poder pedir. Un platillo agotado (available=false y NO
 * extra) queda fuera. Misma forma que getMenuCategories.
 */
export async function getStaffMenuCategories() {
  return prisma.menuCategory.findMany({
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      position: true,
      createdAt: true,
      dishes: {
        where: { OR: [{ available: true }, { isExtra: true }] },
        orderBy: { position: "asc" },
      },
    },
  });
}

export async function getMenuCategoryById(id: string) {
  return prisma.menuCategory.findUnique({
    where: { id },
    include: {
      dishes: {
        where: { available: true },
        orderBy: { position: "asc" },
      },
    },
  });
}

export async function getMenuCategoryByName(name: string) {
  // El parámetro suele venir como slug ("vino-tinto", "especialidades-del-chef").
  // Convertimos guiones en espacios para que matchee el `name` real en DB
  // ("Vino Tinto", "Especialidades del Chef"). Para nombres sin guion (e.g.
  // "Antipasti") la transformación es no-op.
  const normalized = name.replace(/-/g, " ");
  return prisma.menuCategory.findFirst({
    where: { name: { equals: normalized, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      position: true,
      createdAt: true,
      dishes: {
        where: { available: true },
        orderBy: { position: "asc" },
      },
    },
  });
}

// ============================================
// FEATURED DISHES
// ============================================

// Platos insignia — lista curada por nombre exacto en la BD.
// La página del menú muestra 3 al azar de esta lista en cada carga.
const FEATURED_DISH_NAMES = [
  "Carpaccio di Manzo Wagyu",
  "Carpaccio di Salmone",
  "Carpaccio di Totoaba al Tartufo",
  "Lasagna di Wagyu",
  "Alfredo nella Ruota di Grana Padano",
  "Filete al Wellington estilo Gordon Ramsay",
  "Francescana",
  "Cream Chowder",
];

export async function getFeaturedDishes() {
  return prisma.dish.findMany({
    where: { available: true, name: { in: FEATURED_DISH_NAMES } },
    include: { category: { select: { name: true } } },
  });
}

// Grupos que son bebidas/destilados — se excluyen de los platos insignia
const DRINK_GROUP_SLUGS = new Set(["bebidas", "destilados", "vinos", "brunch-bebidas"]);

export async function getTopDishesBySection(section: "comida" | "brunch", limit = 3) {
  const groups = section === "comida" ? COMIDA_GROUPS : BRUNCH_GROUPS;
  const foodGroups = groups.filter((g) => !DRINK_GROUP_SLUGS.has(g.slug));
  // Las categorías de brunch en la DB tienen el sufijo " (Brunch)"
  const categoryNames = foodGroups.flatMap((g) =>
    g.categories.map((c) => section === "brunch" ? `${c.name} (Brunch)` : c.name)
  );

  return prisma.dish.findMany({
    where: {
      available: true,
      category: { name: { in: categoryNames } },
    },
    orderBy: { price: "desc" },
    take: limit,
    include: {
      category: { select: { name: true } },
    },
  });
}

// ============================================
// LOCATIONS
// ============================================

export async function getActiveLocations() {
  return [];
}

// // ============================================
// // CONTACT
// // ============================================

// export async function createContactMessage(data: ContactFormData) {
//   return prisma.contactMessage.create({ data });
// }

// export async function getContactMessages(options?: {
//   isRead?: boolean;
//   limit?: number;
// }) {
//   return prisma.contactMessage.findMany({
//     where: {
//       ...(options?.isRead !== undefined && { isRead: options.isRead }),
//     },
//     orderBy: { createdAt: "desc" },
//     take: options?.limit,
//   });
// }