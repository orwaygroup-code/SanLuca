/* ═══════════════════════════════════════════════════════════
   app/layout.tsx — GUÍA DE INTEGRACIÓN
   
   NO reemplaces tu layout.tsx completo.
   Solo agrega las líneas marcadas con ✅
   ═══════════════════════════════════════════════════════════ */

import type { Metadata } from "next";
import { fonts } from "@/config/theme";

// ✅ AGREGAR: estilos globales de San Luca v2
import "@/styles/san-luca.css";

// ✅ AGREGAR: LayoutWrapper (maneja Navbar y Footer condicionalmente)
import { LayoutWrapper } from "@/components/LayoutWrapper";

export const metadata: Metadata = {
  title: "San Luca Ristorante — Auténtica Cocina Italiana",
  description:
    "Restaurante italiano premium en Aguascalientes. Cocina artesanal con ingredientes frescos y recetas de tres generaciones.",
  icons: {
    icon:     "/images/favicon.png",   // pestaña del navegador
    shortcut: "/images/favicon.png",
    apple:    "/images/favicon.png",   // iOS al guardar en pantalla de inicio
  },
  openGraph: {
    images: ["/images/og-logo.png"],   // imagen que aparece al compartir en redes / Google
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head
     >
        {/* ✅ AGREGAR: Google Font para texto script */}
        <link
          href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
