/**
 * Encabezado de página del CRM con la línea del panel admin: título sobrio y subtítulo tenue.
 * La navegación (panel, inicio del CRM) vive en el sidebar, no aquí.
 */
export function CrmPageHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <header style={{ marginBottom: 18 }}>
      <h1 style={{ margin: 0, color: "var(--sl-cream)", fontSize: "1.4rem", fontWeight: 800 }}>{title}</h1>
      {sub && <p style={{ margin: "4px 0 0", color: "var(--sl-dim)", fontSize: "0.82rem" }}>{sub}</p>}
    </header>
  );
}
