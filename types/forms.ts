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
  position: number | null;
  dishes: MenuItem[];
  createdAt: Date;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  available: boolean;
  position: number | null;
  categoryId: string;
  createdAt: Date;
};
