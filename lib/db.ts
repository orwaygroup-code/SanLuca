import { prisma } from "./prisma";
import type { ContactFormData } from "@/types/forms";

// ============================================
// MENU
// ============================================

export async function getMenuCategories() {
  return prisma.menuCategory.findMany({
    orderBy: { position: "asc" },
    include: {
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

// ============================================
// FEATURED DISHES
// ============================================

export async function getFeaturedDishes() {
  return prisma.dish.findMany({
    where: { available: true },
    orderBy: { position: "asc" },
  });
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