// app/api/print-jobs/[id]/ack/route.ts
// El PrintBridge confirma el resultado de un ticket: impreso (ok) o fallido.
// Auth: header x-print-key === process.env.PRINT_BRIDGE_KEY
// Body: { ok: boolean, error?: string }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TENANT } from "@/lib/comanda";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const key = request.headers.get("x-print-key");
  if (!key || !process.env.PRINT_BRIDGE_KEY || key !== process.env.PRINT_BRIDGE_KEY) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const ok = body?.ok === true;
  const error = typeof body?.error === "string" ? body.error.slice(0, 500) : null;

  await prisma.comandaPrint.updateMany({
    where: { id, tenantId: TENANT },
    data: ok
      ? { status: "SUCCESS", errorMessage: null }
      : { status: "FAILED", errorMessage: error, attemptCount: { increment: 1 } },
  });

  return NextResponse.json({ success: true });
}
