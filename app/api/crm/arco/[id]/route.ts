import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-server";
import { Prisma } from "@prisma/client";

/**
 * PATCH /api/crm/arco/[id]
 *
 * Marca etapas del procedimiento (manual §3 del wiki):
 *   - identityVerifiedAt (paso 2)
 *   - evaluationResult   (paso 3)
 *   - executedAt         (paso 4)
 *   - notifiedAt         (paso 5)
 *   - status / notes / executedBy
 *
 * Cualquier campo ausente del body no se modifica. Las fechas se pueden
 * mandar como "now" para usar la hora del servidor, o como ISO string.
 */
export async function PATCH(
  req:    NextRequest,
  { params }: { params: { id: string } },
) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const data: Prisma.ArcoRequestUpdateInput = {};

  // Helper: parsea "now" / ISO / null / undefined.
  const parseDate = (v: unknown): Date | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (v === "now") return new Date();
    if (typeof v === "string") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  };

  const iv = parseDate(body.identityVerifiedAt);
  if (iv !== undefined) data.identityVerifiedAt = iv;

  const ex = parseDate(body.executedAt);
  if (ex !== undefined) data.executedAt = ex;

  const nt = parseDate(body.notifiedAt);
  if (nt !== undefined) data.notifiedAt = nt;

  if (typeof body.evaluationResult === "string") {
    data.evaluationResult = body.evaluationResult.slice(0, 500);
  }
  if (typeof body.notes === "string") {
    data.notes = body.notes.slice(0, 1000);
  }
  if (typeof body.executedBy === "string") {
    data.executedBy = body.executedBy;
  }
  if (typeof body.status === "string"
      && ["IN_PROGRESS", "COMPLETED", "REJECTED"].includes(body.status)) {
    data.status = body.status as "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  }

  // Si el admin marca executedAt sin status, asumimos COMPLETED.
  if (data.executedAt && !data.status) {
    data.status = "COMPLETED";
  }
  // El executedBy default = admin que tocó el botón.
  if (data.executedAt && !data.executedBy) {
    data.executedBy = s.userId;
  }

  try {
    const updated = await prisma.arcoRequest.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ success: true, request: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("[CRM ARCO PATCH]", e);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

/**
 * GET /api/crm/arco/[id] — detalle de una solicitud.
 */
export async function GET(
  req:    NextRequest,
  { params }: { params: { id: string } },
) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const r = await prisma.arcoRequest.findUnique({ where: { id: params.id } });
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ request: r });
}
