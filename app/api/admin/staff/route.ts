import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/staff-auth-server";
import { staffCreateSchema } from "@/lib/validations";
import { resolvePin, PinConflictError } from "@/lib/staff";
import type { ApiResponse } from "@/types";

const PUBLIC_SELECT = {
  id: true, username: true, fullName: true, role: true, active: true,
  lastLoginAt: true, lastShift: true, createdAt: true, updatedAt: true,
} as const;

/**
 * GET /api/admin/staff?role=WAITER&active=true&q=luis
 * Lista de empleados con filtros. Solo MANAGER.
 */
export async function GET(request: NextRequest) {
  const m = await requireManager(request);
  if (!m) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const active = searchParams.get("active"); // "true" | "false" | null (todos)
  const q = searchParams.get("q")?.trim();

  const staff = await prisma.staff.findMany({
    where: {
      tenantId: m.tenantId,
      ...(role && ["WAITER", "OPERATION", "CAPTAIN", "MANAGER"].includes(role)
        ? { role: role as "WAITER" | "OPERATION" | "CAPTAIN" | "MANAGER" }
        : {}),
      ...(active === "true" ? { active: true } : active === "false" ? { active: false } : {}),
      ...(q ? { OR: [
        { username: { contains: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
      ] } : {}),
    },
    select: PUBLIC_SELECT,
    orderBy: [{ active: "desc" }, { role: "asc" }, { fullName: "asc" }],
  });

  return NextResponse.json<ApiResponse>({ success: true, data: staff });
}

/**
 * POST /api/admin/staff  { username, fullName, role, pin? }
 * Crea un empleado. Si no se manda PIN, se genera uno y se devuelve UNA vez
 * en `data.pin` para mostrarlo en pantalla. Solo MANAGER.
 */
export async function POST(request: NextRequest) {
  const m = await requireManager(request);
  if (!m) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = staffCreateSchema.safeParse(body);
  if (!parsed.success) {
    const errors = Object.values(parsed.error.flatten().fieldErrors).flat();
    return NextResponse.json<ApiResponse>({ success: false, error: errors.join(", ") }, { status: 400 });
  }

  const { username, fullName, role, pin: desiredPin } = parsed.data;

  try {
    const { pin, hash } = await resolvePin(desiredPin, { tenantId: m.tenantId });
    const created = await prisma.staff.create({
      data: {
        tenantId: m.tenantId,
        username: username.toLowerCase(),
        fullName,
        role,
        pinHash: hash,
        createdById: m.staffId,
      },
      select: PUBLIC_SELECT,
    });
    // `pin` plano se incluye solo en esta respuesta de creación.
    return NextResponse.json<ApiResponse>({ success: true, data: { ...created, pin } }, { status: 201 });
  } catch (e) {
    if (e instanceof PinConflictError) {
      return NextResponse.json<ApiResponse>({ success: false, error: "PIN_TAKEN" }, { status: 409 });
    }
    const isUnique = e instanceof Error && e.message.includes("Unique constraint");
    return NextResponse.json<ApiResponse>(
      { success: false, error: isUnique ? "USERNAME_TAKEN" : "Error al crear empleado" },
      { status: isUnique ? 409 : 500 }
    );
  }
}
