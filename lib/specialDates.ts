import { prisma } from "./prisma";

export interface SpecialDateInfo {
  id: string;
  month: number;
  day: number;
  label: string;
  amount: number;
}

/** Defaults seeded on first run if SpecialDate table is empty. */
export const DEFAULT_SPECIAL_DATES = [
  { month: 2,  day: 14, label: "San Valentín",       amount: 500 },
  { month: 5,  day: 10, label: "Día de las Madres",  amount: 500 },
  { month: 12, day: 24, label: "Nochebuena",         amount: 500 },
  { month: 12, day: 31, label: "Año Nuevo",          amount: 500 },
];

/**
 * Looks up a special date by "YYYY-MM-DD" string. Returns null if not special.
 * Recurring per year — we match by month+day only, ignoring year.
 */
export async function getSpecialDateForDateStr(
  dateStr: string
): Promise<SpecialDateInfo | null> {
  if (!dateStr || dateStr.length < 10) return null;
  const [, mm, dd] = dateStr.split("-").map((n) => parseInt(n, 10));
  if (!mm || !dd) return null;

  const found = await prisma.specialDate.findFirst({
    where: { month: mm, day: dd, isActive: true },
  });
  if (!found) return null;
  return {
    id: found.id,
    month: found.month,
    day: found.day,
    label: found.label,
    amount: found.amount,
  };
}

/** Seed defaults if table is empty. Safe to call on every boot. */
export async function ensureSpecialDatesSeeded() {
  const count = await prisma.specialDate.count();
  if (count > 0) return;
  await prisma.specialDate.createMany({
    data: DEFAULT_SPECIAL_DATES.map((d) => ({ ...d, isActive: true })),
    skipDuplicates: true,
  });
}
