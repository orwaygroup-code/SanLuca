import { CrmPageHead } from "@/components/crm/CrmPageHead";

export default function KpiPage() {
  return (
    <>
      <CrmPageHead title="KPIs" sub="Métricas del CRM" />
      <div style={{
        background: "var(--sl-panel)", border: "1px solid var(--sl-border)", borderRadius: 12,
        padding: 60, color: "rgb(var(--sl-cream-rgb) / 0.4)", textAlign: "center",
      }}>
        Próximamente — métricas avanzadas (ROI marketing, LTV, retención por cohortes, etc.)
      </div>
    </>
  );
}
