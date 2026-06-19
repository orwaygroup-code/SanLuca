// Tipos compartidos del módulo Marketing del CRM.
// Mientras no exista el backend real, las funciones de lib/marketing-mock.ts
// emulan los endpoints con localStorage + datos hardcoded.

export type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type TargetStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";
export type TagFilterSource = "conv" | "user" | "both";
export type TagFilterMode = "any" | "all";

export interface TemplateButton {
  type: "URL" | "QUICK_REPLY";
  text: string;
  url?: string;
}

export interface TemplateVariable {
  index: number;        // 1, 2, 3...
  example: string;      // valor de ejemplo para preview
  label: string;        // descripción humana ("Nombre del cliente")
}

export interface MetaTemplate {
  name: string;                       // "promo_semana_san_luca"
  category: "MARKETING" | "UTILITY";
  language: string;                   // "es_MX"
  status: "APPROVED" | "PENDING" | "REJECTED";
  bodyText: string;                   // texto con {{1}}, {{2}}, etc
  headerType?: "IMAGE" | "VIDEO" | "TEXT";
  headerExample?: string;             // URL placeholder para preview
  variables: TemplateVariable[];
  buttons?: TemplateButton[];
}

export interface MarketingCampaign {
  id: string;
  name: string;
  templateName: string;
  templateLanguage: string;
  templateParams: Record<string, string>;   // { "1": "Paul", "2": "15" }
  headerImageUrl?: string | null;            // URL si el template tiene IMAGE header
  filters: {
    tagIds: string[];
    mode: TagFilterMode;
    source: TagFilterSource;
  };
  status: CampaignStatus;
  scheduledAt: string | null;          // ISO
  startedAt: string | null;
  completedAt: string | null;
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignPreview {
  estimatedTotal: number;
  sampleTargets: Array<{
    phone: string;
    name: string | null;
    tagNames: string[];
  }>;
}
