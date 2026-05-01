export function CrmPageHead({ title, accent, sub }: { title: string; accent: string; sub?: string }) {
  return (
    <header style={{ marginBottom: 36 }}>
      <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 2.8rem)", fontWeight: 500, letterSpacing: "0.02em" }}>
        <span style={{ color: "#ba843c" }}>{accent}</span> <span style={{ color: "#f5f1e8" }}>{title}</span>
      </h1>
      {sub && (
        <p style={{ margin: "6px 0 0", color: "rgba(245,241,232,0.65)", fontSize: "0.85rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {sub}
        </p>
      )}
    </header>
  );
}
