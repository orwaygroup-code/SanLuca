import { NextResponse } from "next/server";
import { clearSessionCookieString } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.headers.set("Set-Cookie", clearSessionCookieString());
  return res;
}
