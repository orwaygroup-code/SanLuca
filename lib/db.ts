import { prisma } from "./prisma";
import type { ContactFormData } from "@/types/forms";

// ============================================
// LOCATIONS
// ============================================
export async function getActiveLocations() {
  return prisma.location.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });
}

export async function getLocationById(id: string) {
  return prisma.location.findUnique({ where: { id } });
}

// ============================================
// MENU
// ============================================
export async function getMenuCategories(menuId?: string) {
  return prisma.menuCategory.findMany({
    where: { isActive: true, ...(menuId && { menuId }) },
    include: {
      items: {
        where: { isAvailable: true },
        include: {
          images: { orderBy: { displayOrder: "asc" } },
          tags: { include: { tag: true } },
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { order: "asc" },
  });
}

export async function getMenuCategoryBySlug(slug: string, menuId?: string) {
  return prisma.menuCategory.findFirst({
    where: { slug, isActive: true, ...(menuId && { menuId }) },
    include: {
      items: {
        where: { isAvailable: true },
        include: {
          images: { orderBy: { displayOrder: "asc" } },
          tags: { include: { tag: true } },
        },
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function getFeaturedItems() {
  return prisma.menuItem.findMany({
    where: { isFeatured: true, isAvailable: true },
    include: {
      category: true,
      images: { orderBy: { displayOrder: "asc" } },
      tags: { include: { tag: true } },
    },
    orderBy: { order: "asc" },
  });
}

// ============================================
// CONTACT
// ============================================
export async function createContactMessage(data: ContactFormData) {
  return prisma.contactMessage.create({ data });
}

export async function getContactMessages(options?: {
  locationId?: string;
  isRead?: boolean;
  limit?: number;
}) {
  return prisma.contactMessage.findMany({
    where: {
      ...(options?.locationId && { locationId: options.locationId }),
      ...(options?.isRead !== undefined && { isRead: options.isRead }),
    },
    include: { location: true },
    orderBy: { createdAt: "desc" },
    take: options?.limit,
  });
}
