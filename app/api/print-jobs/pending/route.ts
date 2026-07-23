// app/api/print-jobs/pending/route.ts
// El PrintBridge (PC de caja) jala aquí los tickets PENDING para imprimir.
// Auth: header x-print-key === process.env.PRINT_BRIDGE_KEY

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TENANT } from "@/lib/comanda";

export async function GET(request: NextRequest) {
  const key = request.headers.get("x-print-key");
  if (!key || !process.env.PRINT_BRIDGE_KEY || key !== process.env.PRINT_BRIDGE_KEY) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.comandaPrint.findMany({
    where: { tenantId: TENANT, status: "PENDING" },
    orderBy: { printedAt: "asc" },
    take: 25,
    select: { id: true, type: true, target: true, payload: true, attemptCount: true },
  });

  return NextResponse.json({ success: true, jobs });
}
