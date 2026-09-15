import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/dualAuth";
import { buildReportData } from "@/lib/reportsData";
import type { ApiResponse } from "@/types";

/**
 * GET /api/admin/reports?range=today|7d|30d[&cashSessionId=N] — agregados de ventas
 * para el dashboard del manager. Solo ADMIN (sl_session). La agregación vive en
 * lib/reportsData.ts, compartida con reports/print para que el papel sea evidencia.
 */
export async function GET(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  const { data } = await buildReportData(sp);
  return NextResponse.json<ApiResponse>({ success: true, data });
}
