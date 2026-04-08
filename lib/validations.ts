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
    .max(20, "Máximo 20 personas"),

  // Preferencias
  sectionPreference: z
    .enum(["Terraza", "Planta Alta", "Salón", "Privado"])
    .optional(),
  occasion: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),

  // Mesa seleccionada en el mapa
  tableId:       z.string().cuid().optional(),
  linkedTableId: z.string().cuid().optional(),
  thirdTableId:  z.string().cuid().optional(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;