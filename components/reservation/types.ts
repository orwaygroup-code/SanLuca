import type { SelectOption } from "@/components/ui/GoldSelect";

export interface AvailableTable {
  id:       string;
  number:   number;
  capacity: number;
  status:   "available" | "occupied";
}

export interface AvailablePair {
  tableA: { id: string; number: number };
  tableB: { id: string; number: number };
}

export interface AvailableTriple {
  tableA: { id: string; number: number };
  tableB: { id: string; number: number };
  tableC: { id: string; number: number };
}

export interface AvailableQuad {
  tableA: { id: string; number: number };
  tableB: { id: string; number: number };
  tableC: { id: string; number: number };
  tableD: { id: string; number: number };
}

export interface TableSelection {
  tableId:             string;
  tableNumber:         number;
  linkedTableId?:      string;
  linkedTableNumber?:  number;
  thirdTableId?:       string;
  thirdTableNumber?:   number;
  fourthTableId?:      string;
  fourthTableNumber?:  number;
}

export interface AvailabilityData {
  sectionName:         string;
  tables?:             AvailableTable[];
  pairs?:              AvailablePair[];
  triples?:            AvailableTriple[];
  quads?:              AvailableQuad[];
  hasAvailability:     boolean;
  isLargeGroup?:       boolean;
  blockedByLargeGroup?: boolean;
  reason?:             string | null;
}

// ── Shared reservation constants & types (admin page + reservation modals) ──
export const MX_TZ = "America/Mexico_City";

export const MODAL_SECTIONS = ["Terraza", "Planta Alta", "Salón", "Privado"] as const;

export const OCCASION_OPTIONS: SelectOption[] = [
  { value: "",                  label: "— Sin celebración —"  },
  { value: "Cumpleaños",        label: "🎂  Cumpleaños"        },
  { value: "Aniversario",       label: "🥂  Aniversario"       },
  { value: "Cena de negocios",  label: "💼  Cena de negocios"  },
  { value: "Pedida de mano",    label: "💍  Pedida de mano"    },
  { value: "Otro",              label: "✨  Otro"              },
];

export interface Reservation {
    id:                string;
    guestName:         string;
    guestPhone:        string;
    date:              string;
    guests:            number;
    sectionPreference: string | null;
    occasion:          string | null;
    notes:             string | null;
    status:            string;
    paymentStatus:     string;
    requiresPayment?:  boolean;
    creditUsed?:       number;
    amountPaid?:       number | string | null;
    checkedInAt:       string | null;
    seenAt:            string | null;
    tablesProvisional: boolean;
    qrToken:           string;
    table:             { number: number; section: { name: string } } | null;
    user:              { name: string; email: string; phone: string };
}
