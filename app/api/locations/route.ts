import { NextResponse } from "next/server";
import { getActiveLocations } from "@/lib/db";
import type { ApiResponse, Location } from "@/types";

export async function GET() {
  try {
    const locations = await getActiveLocations();

    return NextResponse.json<ApiResponse<Location[]>>({
      success: true,
      data: locations as Location[],
    });
  } catch (error) {
    console.error("[API] GET /api/locations error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Error al obtener ubicaciones" },
      { status: 500 }
    );
  }
}
