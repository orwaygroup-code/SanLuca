import { NextRequest, NextResponse } from "next/server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { getAvailableCredit } from "@/lib/credits";
import { getSession } from "@/lib/auth-server";

/**
 * Returns credit balance for a customer.
 * Resolves email from the session (preferred) or email query.
 * Phone always comes from query.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const phone = url.searchParams.get("phone") || "";
  let email = url.searchParams.get("email") || "";

  const s = await getSession(request);

  if (!email && s) {
    const user = await runWithSession(s, () =>
      withApp((db) => db.user.findUnique({
        where: { id: s.userId },
        select: { email: true },
      }))
    );
    if (user?.email) email = user.email;
  }

  if (!email || !phone) {
    return NextResponse.json({ amount: 0 });
  }
  // getAvailableCredit usa prisma admin: lookup cross-session por email+phone.
  const amount = await getAvailableCredit(email, phone);
  return NextResponse.json({ amount });
}
