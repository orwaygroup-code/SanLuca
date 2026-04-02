/* ═══════════════════════════════════════════════════════════
   app/page.tsx — PÁGINA PRINCIPAL
   
   Reemplaza tu page.tsx actual con esto.
   Cada sección se importa como componente independiente.
   ═══════════════════════════════════════════════════════════ */

import Hero from "@/components/Hero";
import Philosophy from "@/components/Philosophy";
import ChefStory from "@/components/ChefStory";
import Origin from "@/components/Origin";
import AdminRedirect from "@/components/AdminRedirect";

export default function HomePage() {
  return (
    <>
      <AdminRedirect />
      <Hero />
      <Philosophy />
      <ChefStory />
      <Origin />
    </>
  );
}
