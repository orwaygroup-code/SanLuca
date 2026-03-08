/* ═══════════════════════════════════════════════════════
   app/page.tsx — PÁGINA PRINCIPAL
   
   Reemplaza o integra estas secciones en tu page.tsx
   ═══════════════════════════════════════════════════════ */

import Hero from "@/components/Hero";
import About from "@/components/About";
import MenuSection from "@/components/MenuSection";
import Featured from "@/components/Featured";
import Testimonials from "@/components/Testimonials";

export default function HomePage() {
  return (
    <>
      <Hero />
      <About />
      <MenuSection />
      <Featured />
      <Testimonials />
    </>
  );
}
