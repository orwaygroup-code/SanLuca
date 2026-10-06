import { CrmPageHead } from "@/components/crm/CrmPageHead";

export default function ConfiguracionPage() {
  return (
    <>
      <CrmPageHead title="Configuración" sub="Configuraciones generales del CRM" />
      <div style={{
        background: "var(--sl-panel)", border: "1px solid var(--sl-border)", borderRadius: 12,
        padding: 60, color: "rgb(var(--sl-cream-rgb) / 0.4)", textAlign: "center",
      }}>
        Próximamente — credenciales (WhatsApp Business, MercadoPago, GA4), webhooks, integraciones.
      </div>
    </>
  );
}
