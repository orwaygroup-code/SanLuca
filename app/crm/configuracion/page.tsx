import { CrmPageHead } from "@/components/crm/CrmPageHead";

export default function ConfiguracionPage() {
  return (
    <>
      <CrmPageHead accent="PANEL" title="DE CONFIGURACIÓN" sub="Configuraciones generales" />
      <div style={{
        background: "#22302e", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 14,
        padding: 60, color: "rgba(245,241,232,0.4)", textAlign: "center",
      }}>
        Próximamente — credenciales (WhatsApp Business, MercadoPago, GA4), webhooks, integraciones.
      </div>
    </>
  );
}
