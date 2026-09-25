import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

const WRITE_DENIED = "Solo un Manager administra el catálogo del almacén";
const isP2002 = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * PATCH /api/almacen/categories/:id — editar, archivar o restaurar. Solo MANAGER.
 * Body { name?, position?, active? } (solo los campos que vengan). Nunca borra: no hay handler de borrado.
 * Archivar (active:false) se bloquea si la categoría tiene productos activos.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireStaffRole(request, ["MANAGER"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: WRITE_DENIED }, { status: 403 });
  if (s.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const cat = await prisma.stockCategory.findFirst({ where: { id, tenantId: TENANT }, select: { id: true, name: true } });
  if (!cat) return NextResponse.json<ApiResponse>({ success: false, error: "Categoría no encontrada" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; position?: number | null; active?: boolean; archivedAt?: Date | null } = {};

  if (body?.name !== undefined) {
    const name = (typeof body.name === "string" ? body.name.trim() : "").slice(0, 80);
    if (!name) return NextResponse.json<ApiResponse>({ success: false, error: "El nombre es obligatorio" }, { status: 400 });
    const clash = await prisma.stockCategory.findFirst({ where: { tenantId: TENANT, name, id: { not: id } }, select: { active: true } });
    if (clash) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: clash.active ? "Ya existe una categoría con ese nombre" : "Ya existe una categoría archivada con ese nombre; restáurala" },
        { status: 409 },
      );
    }
    data.name = name;
  }

  if (body?.position !== undefined) {
    data.position = Number.isInteger(body.position) && body.position >= 0 ? body.position : null;
  }

  if (body?.active === true) {
    data.active = true;
    data.archivedAt = null; // restaurar
  } else if (body?.active === false) {
    // Archivar: no dejar productos activos huérfanos de una categoría archivada.
    const activos = await prisma.stockItem.count({ where: { tenantId: TENANT, categoryId: id, active: true } });
    if (activos > 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: `Esa categoría tiene ${activos} producto(s) activo(s); archívalos primero` }, { status: 409 });
    }
    data.active = false;
    data.archivedAt = new Date();
  }

  try {
    const updated = await prisma.stockCategory.update({ where: { id }, data });
    return NextResponse.json<ApiResponse>({ success: true, data: updated });
  } catch (e) {
    if (isP2002(e)) return NextResponse.json<ApiResponse>({ success: false, error: "Ya existe una categoría con ese nombre" }, { status: 409 });
    console.error("[almacen/categories/:id] PATCH", e);
    return NextResponse.json<ApiResponse>({ success: false, error: "No se pudo actualizar la categoría" }, { status: 500 });
  }
}
