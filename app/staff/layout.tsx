import type { Metadata } from "next";

// Manifest PWA de la sección staff (SSR, para que iOS lo lea): al anclar desde
// cualquier /staff/*, la app instalada abre el login de staff, que enruta por
// rol (mesero→comandas, operación→operación, capitán→capitán). Así cada quien
// cae en su área sin depender del capricho de start_url por página en iOS.
export const metadata: Metadata = {
  manifest: "/api/manifest?start=/staff/login",
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
