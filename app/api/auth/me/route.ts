import { NextRequest, NextResponse } from "next/server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { getSession } from "@/lib/auth-server";

/**
 * Devuelve los datos del usuario autenticado.
 * El cliente llama esto en mount para hidratar contexto (rol/nombre).
 */
export async function GET(request: NextRequest) {
  const s = await getSession(request);
  if (!s) return NextResponse.json({ authenticated: false }, { status: 401 });

  return runWithSession(s, async () => {
    const user = await withApp((db) => db.user.findUnique({
      where:  { id: s.userId },
      select: { id: true, name: true, email: true, role: true },
    }));
    if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
    return NextResponse.json({ authenticated: true, user });
  });
}
