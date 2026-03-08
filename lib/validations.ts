import { z } from "zod";

// ============================================
// CONTACT FORM
// ============================================
export const contactFormSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  email: z.string().email("Ingresa un email válido"),
  locationId: z.string().min(1, "Selecciona una sucursal"),
  message: z
    .string()
    .min(10, "El mensaje debe tener al menos 10 caracteres")
    .max(2000, "El mensaje no puede exceder 2000 caracteres"),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

// ============================================
// API RESPONSE
// ============================================
export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
  });
