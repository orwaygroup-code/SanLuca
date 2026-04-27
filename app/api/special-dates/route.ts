import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSpecialDatesSeeded } from "@/lib/specialDates";

/** Public endpoint: returns active special dates so the form can highlight them. */
export async function GET() {
  await ensureSpecialDatesSeeded();
  const dates = await prisma.specialDate.findMany({
    where: { isActive: true },
    orderBy: [{ month: "asc" }, { day: "asc" }],
    select: { month: true, day: true, label: true, amount: true },
  });
  return NextResponse.json({ dates });
}
