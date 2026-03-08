import Link from "next/link";
import { siteConfig, navigation } from "@/config/site";

export function Header() {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 2rem",
        borderBottom: "1px solid #e5e5e5",
        position: "sticky",
        top: 0,
        backgroundColor: "#fff",
        zIndex: 100,
      }}
    >
      {/* Logo placeholder */}
      <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
        <strong style={{ fontSize: "1.25rem" }}>{siteConfig.name}</strong>
      </Link>

      {/* Navigation */}
      <nav style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{ textDecoration: "none", color: "#333", fontSize: "0.9rem" }}
          >
            {item.label}
          </Link>
        ))}

        {/* CTA */}
        <Link
          href="#ubicaciones"
          style={{
            padding: "0.5rem 1.25rem",
            border: "1px solid #111",
            borderRadius: "4px",
            textDecoration: "none",
            color: "#111",
            fontSize: "0.9rem",
          }}
        >
          Reservar Ahora
        </Link>
      </nav>
    </header>
  );
}
