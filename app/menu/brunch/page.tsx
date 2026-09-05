// ─────────────────────────────────────────────
//  app/menu/brunch/page.tsx
//  Redirect a /menu — la experiencia brunch
//  ya está en la single page con el switch
// ─────────────────────────────────────────────

import { redirect } from "next/navigation";

// Revalida el Full Route Cache cada 60s: archivar un platillo se refleja sin redeploy.
export const revalidate = 60;

export default function BrunchPage() {
    redirect("/menu");
}