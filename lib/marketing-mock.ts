// Mock layer for marketing campaigns. Reemplazar las 4 funciones marcadas
// con // TODO: replace with fetch cuando exista el backend real.

import type {
  CampaignPreview,
  CampaignStatus,
  MarketingCampaign,
  MetaTemplate,
  TagFilterMode,
  TagFilterSource,
} from "@/types/marketing";

const STORAGE_KEY = "sanluca:marketing:campaigns";

// ─── Templates mock (cuando los apruebe Meta, se cargan desde backend) ───

export const MOCK_TEMPLATES: MetaTemplate[] = [
  {
    name: "promo_semana_san_luca",
    category: "MARKETING",
    language: "es_MX",
    status: "APPROVED",
    bodyText:
      "Hola {{1}}! 👋\n\nEsta semana en San Luca tenemos {{2}} en {{3}}.\nAplica del {{4}} al {{5}}.\n\nReserva tu mesa y disfruta la experiencia italiana auténtica 🍝",
    headerType: "IMAGE",
    headerExample: "/images/menu/clasica/paste.png",
    variables: [
      { index: 1, example: "Paul",         label: "Nombre del cliente" },
      { index: 2, example: "15% off",      label: "Tipo de promoción" },
      { index: 3, example: "pastas",       label: "Categoría o platillo" },
      { index: 4, example: "lunes",        label: "Fecha inicio" },
      { index: 5, example: "domingo",      label: "Fecha fin" },
    ],
    buttons: [
      { type: "URL",         text: "Reservar mesa", url: "https://sanlucaristorante.com/reservation" },
      { type: "QUICK_REPLY", text: "Más info" },
    ],
  },
  {
    name: "novedad_menu_san_luca",
    category: "MARKETING",
    language: "es_MX",
    status: "APPROVED",
    bodyText:
      "{{1}}, presentamos un nuevo platillo:\n\n🍽️ *{{2}}*\n{{3}}\n\nDisponible desde {{4}}. Te esperamos en San Luca.",
    headerType: "IMAGE",
    headerExample: "/images/menu/clasica/pizza.png",
    variables: [
      { index: 1, example: "Paul",                                 label: "Nombre del cliente" },
      { index: 2, example: "Risotto al Tartufo",                   label: "Nombre del platillo" },
      { index: 3, example: "Arroz Arborio con trufa negra fresca", label: "Descripción corta" },
      { index: 4, example: "este viernes",                         label: "Fecha de lanzamiento" },
    ],
    buttons: [
      { type: "URL", text: "Ver menú",       url: "https://sanlucaristorante.com/menu/comida" },
      { type: "URL", text: "Reservar mesa",  url: "https://sanlucaristorante.com/reservation" },
    ],
  },
  {
    name: "recordatorio_evento_san_luca",
    category: "MARKETING",
    language: "es_MX",
    status: "APPROVED",
    bodyText:
      "{{1}}, te recordamos:\n\n📅 {{2}}\n🕐 {{3}}\n🎉 {{4}}\n\nReserva con anticipación, los lugares son limitados.",
    headerType: "IMAGE",
    headerExample: "/images/menu/clasica/terra.png",
    variables: [
      { index: 1, example: "Paul",                  label: "Nombre del cliente" },
      { index: 2, example: "Sábado 24 de junio",    label: "Fecha del evento" },
      { index: 3, example: "8:00 pm",               label: "Hora del evento" },
      { index: 4, example: "Cena maridaje italiana", label: "Nombre del evento" },
    ],
    buttons: [
      { type: "URL",         text: "Reservar",         url: "https://sanlucaristorante.com/reservation" },
      { type: "QUICK_REPLY", text: "Quiero más info" },
    ],
  },
];

// ─── Storage helpers ────────────────────────────────────────────────────

function loadAll(): MarketingCampaign[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MarketingCampaign[]) : [];
  } catch {
    return [];
  }
}

function saveAll(list: MarketingCampaign[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // silencioso
  }
}

// ─── API mock (4 funciones que se reemplazan con fetch) ─────────────────

// TODO: replace with fetch GET /api/crm/marketing/templates
export async function fetchTemplates(): Promise<MetaTemplate[]> {
  await new Promise((r) => setTimeout(r, 200));
  return MOCK_TEMPLATES.filter((t) => t.status === "APPROVED");
}

// TODO: replace with fetch GET /api/crm/marketing/campaigns
export async function fetchCampaigns(): Promise<MarketingCampaign[]> {
  await new Promise((r) => setTimeout(r, 150));
  return loadAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// TODO: replace with fetch POST /api/crm/marketing/campaigns
export async function createCampaign(input: {
  name: string;
  templateName: string;
  templateLanguage: string;
  templateParams: Record<string, string>;
  headerImageUrl?: string | null;
  filters: { tagIds: string[]; mode: TagFilterMode; source: TagFilterSource };
  scheduledAt?: string | null;
}): Promise<MarketingCampaign> {
  await new Promise((r) => setTimeout(r, 250));
  const now = new Date().toISOString();
  const campaign: MarketingCampaign = {
    id: `mock_${Math.random().toString(36).slice(2, 10)}`,
    name: input.name,
    templateName: input.templateName,
    templateLanguage: input.templateLanguage,
    templateParams: input.templateParams,
    headerImageUrl: input.headerImageUrl ?? null,
    filters: input.filters,
    status: input.scheduledAt ? "SCHEDULED" : "DRAFT",
    scheduledAt: input.scheduledAt ?? null,
    startedAt: null,
    completedAt: null,
    totalTargets: 0,
    sentCount: 0,
    failedCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const all = loadAll();
  all.push(campaign);
  saveAll(all);
  return campaign;
}

// TODO: replace with fetch POST /api/crm/marketing/campaigns/[id]/preview
export async function previewCampaign(filters: {
  tagIds: string[];
  mode: TagFilterMode;
  source: TagFilterSource;
}): Promise<CampaignPreview> {
  await new Promise((r) => setTimeout(r, 350));
  // Mock determinístico: el conteo escala con el número de tags elegidos.
  const base = filters.tagIds.length === 0 ? 0 : 35 + filters.tagIds.length * 47;
  const estimatedTotal =
    filters.mode === "all" && filters.tagIds.length > 1
      ? Math.max(1, Math.floor(base / 2))
      : base;
  const sample = [
    { phone: "5214495780669", name: "Cliente Prueba 1", tagNames: ["VIP", "Frecuente"] },
    { phone: "5214495123456", name: "Cliente Prueba 2", tagNames: ["Nuevo"] },
    { phone: "5214499876543", name: null,                tagNames: ["VIP"] },
  ];
  return { estimatedTotal, sampleTargets: sample.slice(0, Math.min(estimatedTotal, sample.length)) };
}

// ─── Helpers de presentación ────────────────────────────────────────────

export function renderTemplateBody(
  template: MetaTemplate,
  params: Record<string, string>,
): string {
  let body = template.bodyText;
  for (const v of template.variables) {
    const value = params[String(v.index)]?.trim() || `{{${v.index}}}`;
    body = body.replaceAll(`{{${v.index}}}`, value);
  }
  return body;
}

export function statusBadgeColor(status: CampaignStatus): { bg: string; border: string; text: string } {
  switch (status) {
    case "DRAFT":     return { bg: "rgba(245,241,232,0.06)", border: "rgba(245,241,232,0.20)", text: "rgba(245,241,232,0.65)" };
    case "SCHEDULED": return { bg: "rgba(74,158,202,0.10)",  border: "rgba(74,158,202,0.45)",  text: "#4a9eca" };
    case "SENDING":   return { bg: "rgba(186,132,60,0.10)",  border: "rgba(186,132,60,0.45)",  text: "#ba843c" };
    case "COMPLETED": return { bg: "rgba(95,161,95,0.10)",   border: "rgba(95,161,95,0.45)",   text: "#5fa15f" };
    case "FAILED":    return { bg: "rgba(224,85,85,0.10)",   border: "rgba(224,85,85,0.45)",   text: "#e05555" };
    case "CANCELLED": return { bg: "rgba(245,241,232,0.04)", border: "rgba(245,241,232,0.15)", text: "rgba(245,241,232,0.40)" };
  }
}

export function statusLabel(status: CampaignStatus): string {
  switch (status) {
    case "DRAFT":     return "Borrador";
    case "SCHEDULED": return "Programada";
    case "SENDING":   return "Enviando";
    case "COMPLETED": return "Completada";
    case "FAILED":    return "Con errores";
    case "CANCELLED": return "Cancelada";
  }
}

export type { CampaignStatus, TagFilterMode, TagFilterSource };
