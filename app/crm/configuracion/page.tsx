import { CrmPageHead } from "@/components/crm/CrmPageHead";

export default function ConfiguracionPage() {
  return (
    <>
      <CrmPageHead accent="PANEL" title="DE CONFIGURACIÓN" sub="Configuraciones generales" />
      <div style={{
        background: "var(--sl-panel2)", border: "1px solid rgb(var(--sl-veil-rgb) / 0.04)", borderRadius: 14,
        padding: 60, color: "rgb(var(--sl-cream-rgb) / 0.4)", textAlign: "center",
      }}>
        Próximamente — credenciales (WhatsApp Business, MercadoPago, GA4), webhooks, integraciones.
      </div>
    </>
  );
}
