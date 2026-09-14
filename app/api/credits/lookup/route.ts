import { NextRequest, NextResponse } from "next/server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { getAvailableCredit } from "@/lib/credits";
import { getSession } from "@/lib/auth-server";

/**
 * Returns credit balance for a customer. Requires a session; the email ALWAYS
 * comes from the session (never the query, para que nadie consulte el saldo de
 * otro cliente por URL). Phone comes from the query (lo que el usuario escribe en
 * el formulario de reserva), normalizado a dígitos.
 */
export async function GET(request: NextRequest) {
  const s = await getSession(request);
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const phone = (url.searchParams.get("phone") || "").replace(/\D/g, "");

  const user = await runWithSession(s, () =>
    withApp((db) => db.user.findUnique({
      where: { id: s.userId },
      select: { email: true },
    }))
  );
  const email = user?.email ?? "";

  if (!email || !phone) {
    return NextResponse.json({ amount: 0 });
  }
  // getAvailableCredit usa prisma admin: lookup cross-session por email+phone.
  const amount = await getAvailableCredit(email, phone);
  return NextResponse.json({ amount });
}
