import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signGoogleToken } from "@/lib/google-token";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("state") || "/reservation";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=google_cancelled", request.url));
  }

  try {
    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
        grant_type:    "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("No access_token");

    // 2. Get user profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    const { id: googleId, email, name } = profile as { id: string; email: string; name: string };

    if (!googleId || !email) throw new Error("Perfil incompleto");

    // 3. Find or create user
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (user) {
      // Link googleId if logged in with same email before
      if (!user.googleId) {
        user = await prisma.user.update({ where: { id: user.id }, data: { googleId } });
      }
    } else {
      user = await prisma.user.create({
        data: { googleId, email, name, phone: "", passwordHash: null },
      });
    }

    // 4. Create signed short-lived token and redirect to login page
    const gt = signGoogleToken(user.id, user.name, user.role);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("gt", gt);
    loginUrl.searchParams.set("redirect", redirect);

    return NextResponse.redirect(loginUrl.toString());
  } catch (e) {
    console.error("[Google OAuth callback]", e);
    return NextResponse.redirect(new URL("/login?error=google_failed", request.url));
  }
}
