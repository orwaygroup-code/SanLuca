// ─────────────────────────────────────────────
//  app/menu/page.tsx
//  Ruta /menu — solo el sistema de menú interactivo
//  El hero principal vive en app/page.tsx (HOME)
// ─────────────────────────────────────────────

import type { Metadata } from "next";
import { getTopDishesBySection, getMenuCategories } from "@/lib/db";
import MenuPageClient from "@/components/menu/MenuPageClient";

export const metadata: Metadata = {
  title: "Menú | San Luca",
  description: "Explora nuestro menú de cocina italiana premium",
};

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
  const [comidaRaw, brunchRaw, categories] = await Promise.all([
    getTopDishesBySection("comida", 3),
    getTopDishesBySection("brunch", 3),
    getMenuCategories(),
  ]);

  const dbCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    imageUrl: (c as any).imageUrl ?? null,
  }));

  return (
    <MenuPageClient
      comidaDishes={comidaRaw.map(mapDish)}
      brunchDishes={brunchRaw.map(mapDish)}
      dbCategories={dbCategories}
    />
  );
}