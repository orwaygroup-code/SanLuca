import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvailableCredit } from "@/lib/credits";

/**
 * Returns credit balance for a customer.
 * Resolves email from x-user-id (preferred) or email query.
 * Phone always comes from query.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const phone = url.searchParams.get("phone") || "";
  let email = url.searchParams.get("email") || "";

  if (!email) {
    const userId = request.headers.get("x-user-id");
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user?.email) email = user.email;
    }
  }

  if (!email || !phone) {
    return NextResponse.json({ amount: 0 });
  }
  const amount = await getAvailableCredit(email, phone);
  return NextResponse.json({ amount });
}
