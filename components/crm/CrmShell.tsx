"use client";

import Link from "next/link";
import { useSession } from "@/lib/session-client";
import { AdminShell } from "@/components/admin/AdminShell";
import { C } from "@/components/staff/ui";

/**
 * Shell del CRM: el MISMO del panel admin (sidebar, guard de sesión, drawer en móvil y crédito
 * al pie), con la sección CRM desplegada en el menú. Encima, el CRM sigue siendo solo de ADMIN:
 * HOSTES entra al panel pero aquí ve un aviso en vez del contenido.
 */
export function CrmShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell>
      <CrmGate>{children}</CrmGate>
    </AdminShell>
  );
}

function CrmGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  if (session.loading || !session.user) return null; // AdminShell ya redirige sin sesión

  if (session.user.role !== "ADMIN") {
    return (
      <div style={{ padding: 22, maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ padding: "20px 22px", maxWidth: 520, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, color: C.cream }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>El CRM es solo para administradores.</div>
          <Link href="/admin" style={{ color: C.gold, fontSize: "0.85rem", fontWeight: 700 }}>Volver al panel</Link>
        </div>
      </div>
    );
  }

  return <div style={{ padding: 22, maxWidth: 1200, margin: "0 auto", color: C.cream, minWidth: 0 }}>{children}</div>;
}
