// ============================================
// Site-wide configuration
// ============================================
// When converting to SaaS, these values should
// come from a tenant config in the database.
// ============================================

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Restaurant App",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  whatsappBaseUrl:
    process.env.NEXT_PUBLIC_WHATSAPP_BASE_URL || "https://wa.me",
} as const;

export const navigation = [
  { label: "Menú", href: "/menu" },
  { label: "Ubicaciones", href: "#ubicaciones" },
  { label: "Equipo", href: "#experiencia" },
  { label: "Contacto", href: "#contacto" },
] as const;

export const socialLinks = [
  { label: "Instagram", href: "#", icon: "instagram" },
  { label: "Facebook", href: "#", icon: "facebook" },
  { label: "TikTok", href: "#", icon: "tiktok" },
] as const;

export const achievements = [
  { metric: "15+", label: "Años de experiencia" },
  { metric: "3", label: "Sucursales" },
  { metric: "50K+", label: "Clientes satisfechos" },
  { metric: "12", label: "Premios gastronómicos" },
] as const;
