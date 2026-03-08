import { achievements } from "@/config/site";

export function SocialProofSection() {
  return (
    <section
      style={{
        padding: "4rem 2rem",
        maxWidth: "1200px",
        margin: "0 auto",
        borderTop: "1px solid #eee",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "2rem",
          textAlign: "center",
        }}
      >
        {achievements.map((item) => (
          <div key={item.label}>
            <p style={{ fontSize: "2.5rem", fontWeight: "bold", margin: "0" }}>
              {item.metric}
            </p>
            <p style={{ color: "#666", marginTop: "0.25rem" }}>{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
