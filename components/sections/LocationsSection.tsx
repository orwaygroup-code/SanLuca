import type { Location } from "@/types";
import { siteConfig } from "@/config/site";

type Props = {
  locations: Location[];
};

export function LocationsSection({ locations }: Props) {
  return (
    <section
      id="ubicaciones"
      style={{
        padding: "4rem 2rem",
        maxWidth: "1200px",
        margin: "0 auto",
        borderTop: "1px solid #eee",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>
        Ubicaciones y Reservas
      </h2>
      <p style={{ textAlign: "center", color: "#666", marginBottom: "2rem" }}>
        Encuéntranos en la ciudad
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {locations.map((loc) => (
          <article
            key={loc.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "4px",
              padding: "1.5rem",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem" }}>{loc.name}</h3>
            <p style={{ color: "#555", margin: "0 0 0.25rem", fontSize: "0.9rem" }}>
              {loc.address}
            </p>
            <p style={{ color: "#555", margin: "0 0 1rem", fontSize: "0.9rem" }}>
              {loc.phone}
            </p>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <a
                href="#contacto"
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid #111",
                  borderRadius: "4px",
                  textDecoration: "none",
                  color: "#111",
                  fontSize: "0.85rem",
                }}
              >
                Reservar
              </a>
              <a
                href={`${siteConfig.whatsappBaseUrl}/${loc.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid #111",
                  borderRadius: "4px",
                  textDecoration: "none",
                  color: "#111",
                  fontSize: "0.85rem",
                }}
              >
                WhatsApp
              </a>
              <a
                href={loc.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid #111",
                  borderRadius: "4px",
                  textDecoration: "none",
                  color: "#111",
                  fontSize: "0.85rem",
                }}
              >
                Ver Mapa
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
