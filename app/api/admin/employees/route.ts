import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { staffCreateSchema } from "@/lib/validations";
import { resolvePin, PinConflictError } from "@/lib/staff";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

/**
 * CRUD de empleados — MIGRADO de /api/admin/staff a /api/admin/employees (Fase B.2).
 * Realm: sl_session ADMIN (Ricardo). Antes era sl_staff MANAGER.
 */

const PUBLIC_SELECT = {
  id: true, username: true, fullName: true, role: true, active: true,
  lastLoginAt: true, lastShift: true, createdAt: true, updatedAt: true,
} as const;

/** GET /api/admin/employees?role=&active=&q= — lista con filtros. ADMIN. */
export async function GET(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const active = searchParams.get("active");
  const q = searchParams.get("q")?.trim();

  const staff = await prisma.staff.findMany({
    where: {
      tenantId: TENANT,
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

/** POST /api/admin/employees { username, fullName, role, pin? } — crea. ADMIN. */
export async function POST(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = staffCreateSchema.safeParse(body);
  if (!parsed.success) {
    const errors = Object.values(parsed.error.flatten().fieldErrors).flat();
    return NextResponse.json<ApiResponse>({ success: false, error: errors.join(", ") }, { status: 400 });
  }

  const { username, fullName, role, pin: desiredPin } = parsed.data;

  try {
    const { pin, hash } = await resolvePin(desiredPin, { tenantId: TENANT });
    const created = await prisma.staff.create({
      data: {
        tenantId: TENANT,
        username: username.toLowerCase(),
        fullName,
        role,
        pinHash: hash,
        createdById: a.staffId,
      },
      select: PUBLIC_SELECT,
    });
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
