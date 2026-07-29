"use client";

import { DishCrud } from "@/components/admin/DishCrud";

/** Admin → Platillos: CRUD del menú (platillos normales, no extras). Solo ADMIN. */
export default function MenuAdminPage() {
  return <DishCrud isExtra={false} />;
}
