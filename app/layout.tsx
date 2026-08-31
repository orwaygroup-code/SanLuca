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
import { BUILD_ID } from "@/lib/buildId";
import { SplashScreen } from "@/components/SplashScreen";
import { NoZoom } from "@/components/NoZoom";
import { THEME_BOOTSTRAP } from "@/components/ui/ThemeToggle";
import { InstallButton } from "@/components/InstallButton";
import { StaffNotifications } from "@/components/staff/StaffNotifications";
import { StaffCreditConfirmPrompt } from "@/components/staff/StaffCreditConfirmPrompt";
import { DialogHost } from "@/components/ui/DialogHost";

export const metadata: Metadata = {
  // Base para resolver og:image y twitter:image. Sin esto Next las resuelve
  // contra http://localhost:3000 y la vista previa al compartir el sitio en
  // WhatsApp o redes queda sin imagen. Se fuerza https: el dominio sirve por
  // TLS y una URL http en la etiqueta rompe la previsualización.
  metadataBase: new URL(
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://sanlucaristorante.com")
      .replace(/^http:\/\//, "https://")
  ),
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
  // Zoom deshabilitado en toda la app: es una PWA de operación (comandas,
  // cocina, caja) y el pellizco accidental sobre una pantalla táctil
  // desalinea la vista a media comanda. Complemento en CSS
  // (touch-action) y en NoZoom para el doble toque y el pellizco de iOS.
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        {/* Antes del primer pintado: sin esto el sistema parpadea en oscuro
            antes de aplicar el tema guardado. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {/* Google Font para texto script */}
        <link
          href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SplashScreen />
        <NoZoom />
        <PwaRegister buildId={BUILD_ID} />
        <InstallButton />
        <StaffNotifications />
        <StaffCreditConfirmPrompt />
        <DialogHost />
        <SessionProvider>
          <LanguageProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
          </LanguageProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
