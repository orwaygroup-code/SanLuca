import { CrmPageHead } from "@/components/crm/CrmPageHead";

export default function KpiPage() {
  return (
    <>
      <CrmPageHead accent="MÉTRICAS" title="KPI" sub="Bandeja de entrada" />
      <div style={{
        background: "var(--sl-panel2)", border: "1px solid rgb(var(--sl-veil-rgb) / 0.04)", borderRadius: 14,
        padding: 60, color: "rgb(var(--sl-cream-rgb) / 0.4)", textAlign: "center",
      }}>
        Próximamente — métricas avanzadas (ROI marketing, LTV, retención por cohortes, etc.)
      </div>
    </>
  );
}
