import { notFound } from "next/navigation";
import Link from "next/link";
import { getMenuCategoryBySlug, getMenuCategories } from "@/lib/db";
import type { Metadata } from "next";

type Params = { category: string };

export async function generateStaticParams() {
  const categories = await getMenuCategories();
  return categories.map((cat) => ({ category: cat.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getMenuCategoryBySlug(slug);
  if (!category) return { title: "Categoría no encontrada" };
  return {
    title: category.name,
    description: category.description || `Menú: ${category.name}`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { category: slug } = await params;
  const category = await getMenuCategoryBySlug(slug);

  if (!category) notFound();

  return (
    <section style={{ padding: "4rem 2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <Link href="/menu" style={{ display: "inline-block", marginBottom: "1rem" }}>
        ← Volver al menú
      </Link>

      <h1>{category.name}</h1>
      {category.description && <p>{category.description}</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.5rem",
          marginTop: "2rem",
        }}
      >
        {category.items.map((item) => (
          <article
            key={item.id}
            style={{
              border: "1px solid #ddd",
              padding: "1.5rem",
              borderRadius: "4px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ margin: 0 }}>{item.name}</h3>
              <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>
                ${Number(item.price).toFixed(2)}
              </span>
            </div>
            {item.description && (
              <p style={{ color: "#555", marginTop: "0.5rem" }}>{item.description}</p>
            )}
            {item.allergens.length > 0 && (
              <p style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.5rem" }}>
                Alérgenos: {item.allergens.join(", ")}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
