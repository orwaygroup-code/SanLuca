"use client";

import { CapitanBoard } from "@/components/staff/CapitanBoard";

/**
 * Piso en vivo DENTRO del panel admin: al vivir bajo /admin, lo envuelve
 * AdminShell → conserva el menú lateral (Ricardo/Francesca no se pierden). Los
 * datos usan la sesión de staff (PIN); el guard de rol lo hace AdminShell (ADMIN)
 * y el propio tablero (CAPTAIN/MANAGER).
 */
export default function AdminPisoPage() {
  return <CapitanBoard />;
}
