"use client";

import { useEffect } from "react";

export default function NavThemeSetter({ theme }: { theme: "comida" | "brunch" }) {
  // No borramos en cleanup: la siguiente página sobreescribe.
  // Si no, hay un parpadeo entre transiciones donde el navbar pierde el tema.
  useEffect(() => {
    document.body.dataset.navTheme = theme;
  }, [theme]);

  return null;
}
