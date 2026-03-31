import { NextRequest, NextResponse } from "next/server";
import { verifyGoogleToken } from "@/lib/google-token";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ success: false, error: "Token requerido" }, { status: 400 });

  const payload = verifyGoogleToken(token);
  if (!payload) return NextResponse.json({ success: false, error: "Token inválido o expirado" }, { status: 401 });

  return NextResponse.json({ success: true, data: payload });
}
