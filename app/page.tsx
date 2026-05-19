/* ═══════════════════════════════════════════════════════════
   app/page.tsx — PÁGINA PRINCIPAL
   
   Reemplaza tu page.tsx actual con esto.
   Cada sección se importa como componente independiente.
   ═══════════════════════════════════════════════════════════ */

import Hero from "@/components/Hero";
import RonqueoBanner from "@/components/RonqueoBanner";
import Philosophy from "@/components/Philosophy";
import ChefStory from "@/components/ChefStory";
import Origin from "@/components/Origin";
import AdminRedirect from "@/components/AdminRedirect";
import { ImagePrefetcher } from "@/components/ImagePrefetcher";
import { PREFETCH_AFTER_HERO } from "@/config/prefetchImages";

export default function HomePage() {
  return (
    <>
      <AdminRedirect />
      <Hero />
      <RonqueoBanner />
      <Philosophy />
      <ChefStory />
      <Origin />
      <ImagePrefetcher urls={PREFETCH_AFTER_HERO} />
    </>
  );
}
