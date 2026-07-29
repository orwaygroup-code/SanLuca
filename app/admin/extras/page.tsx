"use client";

import { DishCrud } from "@/components/admin/DishCrud";

/** Admin → Extras: platillos/paquetes ocultos del menú (isExtra), pedibles por
 *  meseros con precio especial. Mismo CRUD que Platillos, filtrado a extras. Solo ADMIN. */
export default function ExtrasAdminPage() {
  return <DishCrud isExtra={true} />;
}
