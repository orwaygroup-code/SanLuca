/* ═══════════════════════════════════════════════════════════
   app/layout.tsx — GUÍA DE INTEGRACIÓN
   
   NO reemplaces tu layout.tsx completo.
   Solo agrega las líneas marcadas con ✅
   ═══════════════════════════════════════════════════════════ */

import type { Metadata, Viewport } from "next";
import { fonts } from "@/config/theme";

// ✅ AGREGAR: estilos globales de San Luca v2
import "@/styles/san-luca.css";

// ✅ AGREGAR: LayoutWrapper (maneja Navbar y Footer condicionalmente)
import { LayoutWrapper } from "@/components/LayoutWrapper";
import { LanguageProvider } from "@/lib/i18n";
import { SessionProvider } from "@/lib/session-client";
import { PwaRegister } from "@/components/PwaRegister";
import { SplashScreen } from "@/components/SplashScreen";
import { InstallButton } from "@/components/InstallButton";
import { StaffNotifications } from "@/components/staff/StaffNotifications";

export const metadata: Metadata = {
  title: "San Luca Ristorante — Auténtica Cocina Italiana",
  description:
    "Restaurante italiano premium en Aguascalientes. Cocina artesanal con ingredientes frescos y recetas de tres generaciones.",
  applicationName: "San Luca",
  manifest: "/api/manifest",   // dinámico: start_url = página donde se ancla (ver PwaRegister)
  appleWebApp: {
    capable: true,
    title: "San Luca",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon:     "/images/favicon.png",           // pestaña del navegador
    shortcut: "/images/favicon.png",
    apple:    "/icons/apple-touch-icon.png",   // iOS al guardar en pantalla de inicio
  },
  openGraph: {
    images: ["/images/og-logo.png"],   // imagen que aparece al compartir en redes / Google
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1a2224",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        {/* Google Font para texto script */}
        <link
          href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SplashScreen />
        <PwaRegister />
        <InstallButton />
        <StaffNotifications />
        <SessionProvider>
          <LanguageProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
          </LanguageProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
