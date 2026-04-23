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
  return prisma.menuCategory.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
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

export async function getFeaturedDishes() {
  return prisma.dish.findMany({
    where: { available: true },
    orderBy: { position: "asc" },
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