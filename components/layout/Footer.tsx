import Link from "next/link";
import { siteConfig, socialLinks } from "@/config/site";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        borderTop: "1px solid #e5e5e5",
        padding: "3rem 2rem",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "2rem",
        }}
      >
        {/* Brand */}
        <div>
          <strong>{siteConfig.name}</strong>
          <p style={{ color: "#666", fontSize: "0.875rem", marginTop: "0.5rem" }}>
            Experiencia gastronómica de autor
          </p>
        </div>

        {/* Legal links */}
        <div>
          <strong>Legal</strong>
          <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
            <Link href="/privacidad" style={{ color: "#666", fontSize: "0.875rem", textDecoration: "none" }}>
              Aviso de Privacidad
            </Link>
            <Link href="/terminos" style={{ color: "#666", fontSize: "0.875rem", textDecoration: "none" }}>
              Términos y Condiciones
            </Link>
          </nav>
        </div>

        {/* Social */}
        <div>
          <strong>Redes Sociales</strong>
          <nav style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#666", fontSize: "0.875rem", textDecoration: "none" }}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {/* CTA */}
        <div>
          <Link
            href="#ubicaciones"
            style={{
              display: "inline-block",
              padding: "0.75rem 1.5rem",
              border: "1px solid #111",
              borderRadius: "4px",
              textDecoration: "none",
              color: "#111",
            }}
          >
            Reservar
          </Link>
        </div>
      </div>

      <p style={{ color: "#999", fontSize: "0.75rem", marginTop: "2rem", textAlign: "center" }}>
        &copy; {currentYear} {siteConfig.name}. Todos los derechos reservados.
      </p>
    </footer>
  );
}
