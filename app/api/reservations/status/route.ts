import { NextRequest, NextResponse } from "next/server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { getSession } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const s = await getSession(request);
  return runWithSession(s, async () => {
    const r = await withApp((db) => db.reservation.findUnique({
      where: { id },
      select: {
        status: true,
        paymentStatus: true,
        requiresPayment: true,
        expiresAt: true,
      },
    }));
    if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(r);
  });
}
