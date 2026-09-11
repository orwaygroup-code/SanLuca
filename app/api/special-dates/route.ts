import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Lee la BD en vivo: el formulario debe ver las fechas especiales actuales, no
// las del último build. Sin esto Next la prerenderiza una vez y sirve esa
// respuesta hasta el siguiente deploy.
export const dynamic = "force-dynamic";

/** Public endpoint: returns active special dates so the form can highlight them. */
export async function GET() {
  const dates = await prisma.specialDate.findMany({
    where: { isActive: true },
    orderBy: [{ month: "asc" }, { day: "asc" }],
    select: { month: true, day: true, label: true, amount: true },
  });
  return NextResponse.json({ dates });
}
