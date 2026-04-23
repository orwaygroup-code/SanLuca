"use client";

import { useEffect } from "react";

export default function NavThemeSetter({ theme }: { theme: "comida" | "brunch" }) {
  useEffect(() => {
    document.body.dataset.navTheme = theme;
    return () => { delete document.body.dataset.navTheme; };
  }, [theme]);

  return null;
}
