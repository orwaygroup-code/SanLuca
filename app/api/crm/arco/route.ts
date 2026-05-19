import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-server";
import { Prisma } from "@prisma/client";
import { nextArcoFolio } from "@/lib/arcoFolio";

/**
 * GET /api/crm/arco
 *
 * Lista de solicitudes ARCO (causales A: correo · B: app · C: vencimiento ·
 * D: orden de autoridad). El admin puede filtrar por status/channel/fecha
 * y revisar la traza completa de cada folio.
 *
 * Usa el cliente admin (`prisma`) porque RLS impediría leer un ArcoRequest
 * cuyo titular ya fue borrado (causal B).
 */
export async function GET(req: NextRequest) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const status  = sp.get("status");   // IN_PROGRESS | COMPLETED | REJECTED
  const channel = sp.get("channel");  // APP | EMAIL
  const from    = sp.get("from");     // YYYY-MM-DD
  const to      = sp.get("to");       // YYYY-MM-DD
  const search  = sp.get("search")?.trim();

  const where: Prisma.ArcoRequestWhereInput = {};
  if (status && ["IN_PROGRESS", "COMPLETED", "REJECTED"].includes(status)) {
    where.status = status as "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  }
  if (channel && ["APP", "EMAIL"].includes(channel)) {
    where.channel = channel as "APP" | "EMAIL";
  }
  if (from || to) {
    where.receivedAt = {};
    if (from) where.receivedAt.gte = new Date(`${from}T00:00:00`);
    if (to)   where.receivedAt.lte = new Date(`${to}T23:59:59`);
  }
  if (search) {
    where.OR = [
      { folio:          { contains: search, mode: "insensitive" } },
      { requesterEmail: { contains: search, mode: "insensitive" } },
      { requesterName:  { contains: search, mode: "insensitive" } },
    ];
  }

  const [rows, counts] = await Promise.all([
    prisma.arcoRequest.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: 200,
    }),
    prisma.arcoRequest.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const totals = { IN_PROGRESS: 0, COMPLETED: 0, REJECTED: 0 } as Record<string, number>;
  for (const c of counts) totals[c.status] = c._count._all;

  return NextResponse.json({
    counts: { all: rows.length, ...totals },
    requests: rows.map((r) => ({
      id:                 r.id,
      folio:              r.folio,
      receivedAt:         r.receivedAt,
      channel:            r.channel,
      rightExercised:     r.rightExercised,
      requesterEmail:     r.requesterEmail,
      requesterName:      r.requesterName,
      identityVerifiedAt: r.identityVerifiedAt,
      evaluationResult:   r.evaluationResult,
      executedAt:         r.executedAt,
      executedBy:         r.executedBy,
      notifiedAt:         r.notifiedAt,
      status:             r.status,
      notes:              r.notes,
      createdAt:          r.createdAt,
      updatedAt:          r.updatedAt,
    })),
  });
}

/**
 * POST /api/crm/arco — crear manualmente una solicitud ARCO recibida
 * por correo (causal A). El admin la captura desde el CRM para que
 * entre al registro y pueda procesarse con las mismas etapas que B.
 */
export async function POST(req: NextRequest) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: {
    rightExercised?: string;
    channel?:        string;
    requesterEmail?: string;
    requesterName?:  string;
    notes?:          string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const right = body.rightExercised;
  if (!right || !["ACCESS", "RECTIFICATION", "CANCELLATION", "OPPOSITION"].includes(right)) {
    return NextResponse.json({ error: "invalid_right" }, { status: 400 });
  }
  const channel = body.channel ?? "EMAIL";
  if (!["APP", "EMAIL"].includes(channel)) {
    return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
  }
  if (!body.requesterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.requesterEmail)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const folio = await nextArcoFolio(tx);
    return tx.arcoRequest.create({
      data: {
        folio,
        channel:        channel as "APP" | "EMAIL",
        rightExercised: right as "ACCESS" | "RECTIFICATION" | "CANCELLATION" | "OPPOSITION",
        requesterEmail: body.requesterEmail!,
        requesterName:  body.requesterName ?? null,
        notes:          body.notes?.slice(0, 1000) ?? null,
        status:         "IN_PROGRESS",
      },
    });
  });

  return NextResponse.json({ success: true, folio: created.folio, id: created.id }, { status: 201 });
}
