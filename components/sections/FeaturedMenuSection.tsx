import Link from "next/link";
import type { MenuCategory } from "@/types";

type Props = {
  categories: MenuCategory[];
};

export function FeaturedMenuSection({ categories }: Props) {
  return (
    <section
      id="menu"
      style={{
        padding: "4rem 2rem",
        maxWidth: "1200px",
        margin: "0 auto",
        borderTop: "1px solid #eee",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Menú Destacado</h2>
      <p style={{ textAlign: "center", color: "#666", marginBottom: "2rem" }}>
        Explora nuestras categorías
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/menu/${category.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <article
              style={{
                border: "1px solid #ddd",
                borderRadius: "4px",
                padding: "1.5rem",
              }}
            >
              {/* Image placeholder */}
              <div
                style={{
                  width: "100%",
                  height: "160px",
                  backgroundColor: "#f5f5f5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1rem",
                  borderRadius: "2px",
                }}
              >
                <span style={{ color: "#bbb", fontSize: "0.8rem" }}>[Imagen]</span>
              </div>
              <h3 style={{ margin: "0 0 0.25rem" }}>{category.name}</h3>
              <p style={{ color: "#666", fontSize: "0.875rem", margin: 0 }}>
                {category.dishes.length} platillos
              </p>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
