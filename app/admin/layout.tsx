import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";

// Manifest PWA de la sección admin (SSR, para que iOS lo lea): al anclar desde
// cualquier /admin/*, la app instalada abre en /admin. La lógica del sidebar +
// guard de sesión vive en AdminShell (client).
export const metadata: Metadata = {
  manifest: "/api/manifest?start=/admin",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
