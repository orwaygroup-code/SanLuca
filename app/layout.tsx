/* ═══════════════════════════════════════════════════════
   app/layout.tsx — EJEMPLO DE INTEGRACIÓN
   
   Este archivo muestra las líneas que debes AGREGAR 
   a tu layout.tsx existente. NO reemplaces todo tu 
   archivo, solo agrega lo que te falta.
   ═══════════════════════════════════════════════════════ */

import type { Metadata } from "next";

// ✅ AGREGAR: importar los estilos de San Luca
import "@/styles/san-luca.css";

// ✅ AGREGAR: importar Google Font (Great Vibes para los textos script)
// Opción A: con next/font (recomendado)
// import { Great_Vibes } from "next/font/google";
// const greatVibes = Great_Vibes({ weight: "400", subsets: ["latin"], variable: "--font-great-vibes" });

// ✅ AGREGAR: importar Navbar y Footer
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "San Luca Ristorante",
  description: "Auténtica cocina italiana desde 1987",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        {/* ✅ AGREGAR: Google Font para texto script */}
        <link
          href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* ✅ AGREGAR: Navbar global */}
        <Navbar />

        {/* Tu contenido existente */}
        <main>{children}</main>

        {/* ✅ AGREGAR: Footer global */}
        <Footer />
      </body>
    </html>
  );
}
