import { NextResponse } from "next/server";
import { clearStaffSessionCookieString } from "@/lib/staff-session";
import { clearSessionCookieString } from "@/lib/session";
import type { ApiResponse } from "@/types";

/**
 * POST /api/auth/staff/logout — limpia la cookie `sl_staff` y también la
 * `sl_session` (por el puente de identidad de Ricardo: el login por PIN pudo
 * emitir ambas). Limpiar la de session de más es inocuo para quien no la tenía.
 */
export async function POST() {
  const res = NextResponse.json<ApiResponse>({ success: true });
  res.headers.set("Set-Cookie", clearStaffSessionCookieString());
  res.headers.append("Set-Cookie", clearSessionCookieString());
  return res;
}
