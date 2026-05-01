import { CrmPageHead } from "@/components/crm/CrmPageHead";

export default function KpiPage() {
  return (
    <>
      <CrmPageHead accent="MÉTRICAS" title="KPI" sub="Bandeja de entrada" />
      <div style={{
        background: "#22302e", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 14,
        padding: 60, color: "rgba(245,241,232,0.4)", textAlign: "center",
      }}>
        Próximamente — métricas avanzadas (ROI marketing, LTV, retención por cohortes, etc.)
      </div>
    </>
  );
}
