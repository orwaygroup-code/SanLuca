// ============================================
// API Response wrapper
// ============================================
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ============================================
// Form types
// ============================================
export type ContactFormData = {
  name: string;
  email: string;
  locationId: string;
  message: string;
};

// ============================================
// Domain types (mirrors Prisma but decoupled)
// ============================================
export type Location = {
  id: string;
  name: string;
  address: string;
  phone: string;
  whatsapp: string;
  mapUrl: string;
  imageUrl: string | null;
  isActive: boolean;
  order: number;
};

export type MenuCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  order: number;
  items: MenuItem[];
};

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  allergens: string[];
  categoryId: string;
};
