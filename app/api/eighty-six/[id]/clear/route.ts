import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

const MANAGE_86 = ["OPERATION", "CAPTAIN", "MANAGER"] as const;

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/eighty-six/:id/clear — #6 quita un faltante (ya se repuso el insumo). Marca
 * clearedAt/clearedById. Roles: encargado/Operación/Capitán/Manager.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireStaffRole(request, [...MANAGE_86]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "Solo encargado de área / Manager" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const entry = await prisma.eightySix.findFirst({ where: { id, tenantId: TENANT }, select: { id: true, clearedAt: true } });
  if (!entry) return NextResponse.json<ApiResponse>({ success: false, error: "No encontrado" }, { status: 404 });
  if (entry.clearedAt) return NextResponse.json<ApiResponse>({ success: true, data: { id, alreadyCleared: true } });

  await prisma.eightySix.update({ where: { id }, data: { clearedAt: new Date(), clearedById: s.staffId } });
  return NextResponse.json<ApiResponse>({ success: true, data: { id, cleared: true } });
}
