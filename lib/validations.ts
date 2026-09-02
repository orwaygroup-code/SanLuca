// lib/validations.ts
import { z } from "zod";

// ── Auth ──────────────────────────────────────
export const registerSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  email: z.string().email("Email inválido"),
  phone: z.string().regex(/^[\d\s\+\-\(\)]{8,20}$/, "Número de teléfono inválido"),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido").optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string(),
  // Doble aceptación: Aviso de Privacidad + T&C. El checkbox vivo es uno solo
  // — verlo desmarcado bloquea el registro con error `TERMS_REQUIRED`.
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "TERMS_REQUIRED" }),
  }),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const createReservationSchema = z.object({
  // Titular de la reserva
  guestName: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100),
  guestPhone: z
    .string()
    .regex(/^[\d\s\+\-\(\)]{8,20}$/, "Número de teléfono inválido"),

  // Detalles del turno
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)"),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Formato de hora inválido (HH:MM)"),
  guests: z
    .number()
    .int()
    .min(1, "Mínimo 1 persona")
    .max(500, "Máximo 500 personas"),

  // Preferencias
  sectionPreference: z
    .enum(["Terraza", "Planta Alta", "Salón", "Privado"])
    .optional(),
  occasion: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),

  // Grupo grande (>15 personas): reserva área completa por todo el día
  isLargeGroup: z.boolean().optional(),

  // Mesa seleccionada en el mapa
  tableId:        z.string().cuid().optional(),
  linkedTableId:  z.string().cuid().optional(),
  thirdTableId:   z.string().cuid().optional(),
  fourthTableId:  z.string().cuid().optional(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

// ── Staff (sistema de Comandas) ───────────────
const pin4 = z.string().regex(/^\d{4}$/, "El PIN debe ser de 4 dígitos");
// username: minúsculas, dígitos, punto y guion (ej. "luis.mesero").
const usernameRule = z
  .string()
  .min(3, "El usuario debe tener al menos 3 caracteres")
  .max(40)
  .regex(/^[a-z0-9._-]+$/, "Usuario inválido (usa minúsculas, números, . _ -)");
const staffRoleRule = z.enum(["WAITER", "OPERATION", "CAPTAIN", "MANAGER", "KITCHEN"]);

export const staffLoginSchema = z.object({
  username: z.string().min(1, "Ingresa tu usuario"),
  pin: pin4,
});

export const staffCreateSchema = z.object({
  username: usernameRule,
  fullName: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  role: staffRoleRule,
  // PIN inicial opcional: si no se manda, el backend genera uno y lo muestra una vez.
  pin: pin4.optional(),
});

export const staffUpdateSchema = z.object({
  username: usernameRule.optional(),
  fullName: z.string().min(2).max(100).optional(),
  role: staffRoleRule.optional(),
  active: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Sin cambios" });

export type StaffLoginInput  = z.infer<typeof staffLoginSchema>;
export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;

// ── Platillos / Menú (CRUD admin) ─────────────
const prepAreaRule = z.enum(["BARRA", "COCINA"]);
export const dishCreateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(120),
  description: z.string().max(1000).nullish(),
  price: z.number({ invalid_type_error: "Precio inválido" }).nonnegative("El precio no puede ser negativo"),
  imageUrl: z.string().max(500).nullish(),
  categoryId: z.string().min(1, "Elige una categoría"),
  prepArea: prepAreaRule.nullish(),
  available: z.boolean().optional(),
  active: z.boolean().optional(),
  archived: z.boolean().optional(), // acción (solo update): true=archivar (active→false, archivedAt=now); false=restaurar
  authPin: z.string().optional(),   // PIN de supervisor requerido para ELIMINAR (active:false)
  isExtra: z.boolean().optional(),
  position: z.number().int().nullish(),
});
export const dishUpdateSchema = dishCreateSchema.partial().refine((d) => Object.keys(d).length > 0, { message: "Sin cambios" });

export const menuCategoryCreateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(120),
  position: z.number().int().nullish(),
});

export type DishCreateInput = z.infer<typeof dishCreateSchema>;
export type DishUpdateInput = z.infer<typeof dishUpdateSchema>;