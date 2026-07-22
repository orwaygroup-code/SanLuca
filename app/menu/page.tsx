// ─────────────────────────────────────────────
//  app/menu/page.tsx
//  Ruta /menu — solo el sistema de menú interactivo
//  El hero principal vive en app/page.tsx (HOME)
// ─────────────────────────────────────────────

import { Suspense } from "react";
import type { Metadata } from "next";
import { getFeaturedDishes, getTopDishesBySection, getMenuCategories } from "@/lib/db";
import MenuPageClient from "@/components/menu/MenuPageClient";

export const metadata: Metadata = {
  title: "Menú | San Luca",
  description: "Explora nuestro menú de cocina italiana premium",
};

export const revalidate = 60;

function mapDish(d: any) {
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? null,
    price: Number(d.price),
    imageUrl: d.imageUrl ?? null,
    category: d.category?.name ?? null,
  };
}

export default async function MenuPage() {
  const [featuredComida, brunchRaw, categories] = await Promise.all([
    getFeaturedDishes(),
    getTopDishesBySection("brunch", 3),
    getMenuCategories(),
  ]);

  // Comida insignia: 3 al azar de la lista curada (misma que /menu/comida).
  const comidaShuffled = [...featuredComida];
  for (let i = comidaShuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [comidaShuffled[i], comidaShuffled[j]] = [comidaShuffled[j], comidaShuffled[i]];
  }
  const comidaRaw = comidaShuffled.slice(0, 3);

  const dbCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl ?? null,
  }));

  return (
    <Suspense>
      <MenuPageClient
        comidaDishes={comidaRaw.map(mapDish)}
        brunchDishes={brunchRaw.map(mapDish)}
        dbCategories={dbCategories}
      />
    </Suspense>
  );
}