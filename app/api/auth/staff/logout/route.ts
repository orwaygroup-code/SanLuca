import { NextResponse } from "next/server";
import { clearStaffSessionCookieString } from "@/lib/staff-session";
import type { ApiResponse } from "@/types";

/** POST /api/auth/staff/logout — limpia la cookie `sl_staff`. */
export async function POST() {
  const res = NextResponse.json<ApiResponse>({ success: true });
  res.headers.set("Set-Cookie", clearStaffSessionCookieString());
  return res;
}
