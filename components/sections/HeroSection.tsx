import Link from "next/link";

export function HeroSection() {
  return (
    <section
      style={{
        padding: "6rem 2rem",
        maxWidth: "1200px",
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      {/* Image/video placeholder */}
      <div
        style={{
          width: "100%",
          height: "400px",
          backgroundColor: "#f0f0f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "2rem",
          borderRadius: "4px",
        }}
      >
        <span style={{ color: "#999" }}>[Hero Image / Video Placeholder]</span>
      </div>

      <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", margin: "0 0 1rem" }}>
        Gastronomía de Autor
      </h1>
      <p style={{ fontSize: "1.125rem", color: "#555", maxWidth: "600px", margin: "0 auto 2rem" }}>
        Una experiencia culinaria que fusiona tradición e innovación en cada platillo.
      </p>

      <Link
        href="/menu"
        style={{
          display: "inline-block",
          padding: "0.75rem 2rem",
          border: "1px solid #111",
          borderRadius: "4px",
          textDecoration: "none",
          color: "#111",
        }}
      >
        Ver Menú Degustación
      </Link>
    </section>
  );
}
