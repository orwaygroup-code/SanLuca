"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export function CrmPageHead({ title, accent, sub }: { title: string; accent: string; sub?: string }) {
  const router   = useRouter();
  const pathname = usePathname();
  const isRoot   = pathname === "/crm";

  return (
    <header style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        {!isRoot && (
          <button onClick={() => router.back()} style={btn}>
            ← Atrás
          </button>
        )}
        <Link href="/admin" style={{ ...btn, textDecoration: "none", display: "inline-block" }}>
          Panel admin
        </Link>
        {!isRoot && (
          <Link href="/crm" style={{ ...btn, textDecoration: "none", display: "inline-block" }}>
            Inicio CRM
          </Link>
        )}
      </div>
      <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 2.8rem)", fontWeight: 500, letterSpacing: "0.02em" }}>
        <span style={{ color: "var(--sl-gold)" }}>{accent}</span> <span style={{ color: "var(--sl-cream)" }}>{title}</span>
      </h1>
      {sub && (
        <p style={{ margin: "6px 0 0", color: "rgb(var(--sl-cream-rgb) / 0.65)", fontSize: "0.85rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {sub}
        </p>
      )}
    </header>
  );
}

const btn: React.CSSProperties = {
  padding: "6px 14px",
  background: "transparent",
  border: "1px solid rgb(var(--sl-gold-rgb) / 0.35)",
  borderRadius: 999,
  color: "var(--sl-gold)",
  fontSize: "0.7rem",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: "inherit",
};
