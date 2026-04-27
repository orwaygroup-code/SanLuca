import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const r = await prisma.reservation.findUnique({
    where: { id },
    select: {
      status: true,
      paymentStatus: true,
      requiresPayment: true,
      expiresAt: true,
    },
  });
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(r);
}
