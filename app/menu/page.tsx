import Link from "next/link";
import { getMenuCategories } from "@/lib/db";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Menú",
  description: "Explora nuestro menú de autor",
};

export default async function MenuPage() {
  const categories = await getMenuCategories();

  return (
    <section style={{ padding: "4rem 2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Nuestro Menú</h1>
      <p>Selecciona una categoría para explorar</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "2rem",
          marginTop: "2rem",
        }}
      >
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/menu/${category.slug}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <article
              style={{
                border: "1px solid #ddd",
                padding: "2rem",
                borderRadius: "4px",
              }}
            >
              <h2>{category.name}</h2>
              {category.description && <p>{category.description}</p>}
              <p style={{ fontSize: "0.875rem", color: "#666" }}>
                {category.items.length} platillos
              </p>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
