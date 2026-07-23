"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-client";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

/**
 * Shell (client) de TODAS las páginas /admin/*: sidebar unificado + guard de
 * sesión (ADMIN/HOSTES, realm sl_session). Lo envuelve `app/admin/layout.tsx`
 * (server component), que además declara el manifest PWA de la sección admin.
 *
 * - Desktop (>=768px): grid sidebar fijo (240px) + main con scroll propio.
 * - Mobile (<768px): top bar con hamburger → drawer lateral con overlay.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Detección de viewport (los estilos inline no soportan media queries).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Al volver a desktop, cerrar el drawer.
  useEffect(() => { if (!isMobile) setDrawerOpen(false); }, [isMobile]);

  // Guard de rol: solo ADMIN/HOSTES (realm sl_session).
  useEffect(() => {
    if (session.loading) return;
    if (!session.user || !["ADMIN", "HOSTES"].includes(session.user.role)) {
      router.push("/login?mode=login");
    }
  }, [session.loading, session.user, router]);

  if (session.loading || !session.user) return null;

  const logout = async () => { await session.logout(); router.push("/login?mode=login"); };

  // ── Desktop: grid sidebar + main ──
  if (!isMobile) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", height: "100vh", background: "#0e1817" }}>
        <AdminSidebar userName={session.user.name} onLogout={logout} />
        <main style={{ height: "100vh", overflowY: "auto" }}>{children}</main>
      </div>
    );
  }

  // ── Mobile: top bar + drawer ──
  return (
    <div style={{ minHeight: "100vh", background: "#0e1817", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", background: "#131c1b", borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span style={{ fontSize: "0.7rem", letterSpacing: "0.24em", color: "#ba843c", fontWeight: 800 }}>SAN LUCA · ADMIN</span>
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú"
          style={{ background: "transparent", border: "1px solid rgba(186,132,60,0.35)", color: "#ba843c", borderRadius: 8, padding: "4px 11px", fontSize: "1.15rem", lineHeight: 1, cursor: "pointer", fontFamily: "inherit" }}
        >
          ☰
        </button>
      </div>

      {drawerOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
          />
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 260, maxWidth: "82vw", boxShadow: "4px 0 24px rgba(0,0,0,0.5)" }}>
            <AdminSidebar userName={session.user.name} onLogout={logout} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main style={{ flex: 1, overflowY: "auto" }}>{children}</main>
    </div>
  );
}
