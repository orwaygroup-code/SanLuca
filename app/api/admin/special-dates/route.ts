import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSpecialDatesSeeded } from "@/lib/specialDates";
import { requireAdmin } from "@/lib/auth-server";
import type { ApiResponse } from "@/types";

async function verifyAdmin(request: NextRequest) {
  const s = await requireAdmin(request);
  return s?.userId ?? null;
}

export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "No autorizado" },
      { status: 403 }
    );
  }
  await ensureSpecialDatesSeeded();
  const dates = await prisma.specialDate.findMany({
    orderBy: [{ month: "asc" }, { day: "asc" }],
  });
  return NextResponse.json<ApiResponse>({ success: true, data: dates });
}

export async function POST(request: NextRequest) {
  const adminId = await verifyAdmin(request);
  if (!adminId) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "No autorizado" },
      { status: 403 }
    );
  }
  const body = await request.json();
  const { month, day, label, amount, isActive } = body || {};
  if (
    typeof month !== "number" || month < 1 || month > 12 ||
    typeof day !== "number" || day < 1 || day > 31 ||
    typeof label !== "string" || !label.trim() ||
    typeof amount !== "number" || amount < 0
  ) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Datos inválidos" },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.specialDate.create({
      data: {
        month, day,
        label: label.trim(),
        amount,
        isActive: isActive !== false,
      },
    });
    return NextResponse.json<ApiResponse>({ success: true, data: created }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique")
      ? "Ya existe una fecha especial con ese día y mes"
      : "Error al crear la fecha";
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 409 });
  }
}
