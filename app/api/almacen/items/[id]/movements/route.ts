import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { verifySupervisorPin } from "@/lib/staff";
import { allow, reset } from "@/lib/rateLimit";
import { TENANT } from "@/lib/comanda";
import { notify } from "@/lib/notify";
import { STOCK_MOVE_TYPES, round3, nextBalance, validateMovement, type StockMoveType } from "@/lib/stock";
import type { StaffRole } from "@prisma/client";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Roles por TIPO de movimiento (la tabla es la especificación, no se interpreta).
const ROLES_BY_TYPE: Record<StockMoveType, StaffRole[]> = {
  ENTRADA: ["OPERATION", "CAPTAIN", "MANAGER", "KITCHEN"],
  SALIDA: ["OPERATION", "CAPTAIN", "MANAGER", "KITCHEN"],
  MERMA: ["KITCHEN", "CAPTAIN", "MANAGER"],
  AJUSTE: ["MANAGER"],
};

const READ_ROLES: StaffRole[] = ["OPERATION", "CAPTAIN", "MANAGER", "KITCHEN"];

/**
 * GET /api/almacen/items/:id/movements — historial de un producto (createdAt desc, id desc).
 * Roles: OPERATION, CAPTAIN, MANAGER, KITCHEN. Query: limit (def 50, máx 200), cursor (id
 * del último leído, pagina hacia atrás).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireStaffRole(request, READ_ROLES);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit"));
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(200, limitRaw) : 50;
  const cursorRaw = Number(searchParams.get("cursor"));
  const cursor = Number.isInteger(cursorRaw) && cursorRaw > 0 ? cursorRaw : null;

  const movements = await prisma.stockMovement.findMany({
    where: { tenantId: TENANT, itemId: id, ...(cursor != null ? { id: { lt: cursor } } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true, type: true, quantity: true, balanceAfter: true, unitCost: true,
      supplier: true, reasonCode: true, reason: true, createdAt: true, createdBy: { select: { fullName: true } },
    },
  });

  const data = movements.map((m) => ({
    id: m.id,
    type: m.type,
    quantity: Number(m.quantity),
    balanceAfter: Number(m.balanceAfter),
    unitCost: m.unitCost != null ? Number(m.unitCost) : null,
    supplier: m.supplier,
    reasonCode: m.reasonCode,
    reason: m.reason,
    createdAt: m.createdAt,
    createdBy: { fullName: m.createdBy.fullName },
  }));

  return NextResponse.json<ApiResponse>({ success: true, data });
}

/**
 * POST /api/almacen/items/:id/movements — registra un movimiento. Es el corazón de A-1.
 * Roles POR TIPO (ver ROLES_BY_TYPE). AJUSTE exige además PIN de Manager. El stock del
 * item se recalcula DENTRO de la transacción con candado optimista (los movimientos son
 * la verdad). Body: { type, quantity, reasonCode, reason?, unitCost?, supplier?, pin? }.
 * `reasonCode` = motivo estructurado (obligatorio, ver STOCK_REASONS); `reason` = comentario libre.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));

  // Validación de entrada, antes de tocar nada.
  const rawType = body?.type;
  if (typeof rawType !== "string" || !STOCK_MOVE_TYPES.includes(rawType as StockMoveType)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Tipo de movimiento inválido" }, { status: 400 });
  }
  const type = rawType as StockMoveType;

  // Auth por el rol que exige ESTE tipo.
  const s = await requireStaffRole(request, ROLES_BY_TYPE[type]);
  if (!s) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: `Este movimiento (${type}) requiere rol: ${ROLES_BY_TYPE[type].join(", ")}` },
      { status: 403 },
    );
  }
  if (s.staffId == null) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });
  }

  const quantity = round3(Number(body?.quantity));
  const reasonCode = typeof body?.reasonCode === "string" ? body.reasonCode.trim().slice(0, 60) : ""; // motivo estructurado (A-4)
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : ""; // comentario libre opcional
  const isEntrada = type === "ENTRADA";

  // unitCost y supplier SOLO se aceptan en ENTRADA; en los demás se ignoran.
  let unitCost: number | null = null;
  if (isEntrada && body?.unitCost != null) {
    const uc = Number(body.unitCost);
    if (!Number.isFinite(uc) || uc < 0 || uc > 999999.99) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Costo unitario inválido" }, { status: 400 });
    }
    unitCost = Math.round(uc * 100) / 100;
  }
  const supplier = isEntrada && typeof body?.supplier === "string" ? body.supplier.trim().slice(0, 80) || null : null;

  // AJUSTE: PIN de Manager, mismo patrón que /api/comandas/[id]/reopen.
  if (type === "AJUSTE") {
    const pin = typeof body?.pin === "string" ? body.pin : "";
    const rlKey = `stock-adjust:${s.staffId}`;
    if (!allow(rlKey, 5, 15 * 60_000)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
    }
    const okPin = await verifySupervisorPin(pin, { tenantId: TENANT, roles: ["MANAGER"] });
    if (!okPin) {
      return NextResponse.json<ApiResponse>({ success: false, error: "PIN de administrador (Manager) inválido" }, { status: 403 });
    }
    reset(rlKey);
  }

  const item = await prisma.stockItem.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, name: true, unit: true, active: true },
  });
  if (!item) return NextResponse.json<ApiResponse>({ success: false, error: "Producto no encontrado" }, { status: 404 });
  if (!item.active) return NextResponse.json<ApiResponse>({ success: false, error: "El producto está archivado" }, { status: 409 });

  // Transacción con el patrón de /pay: relectura fresca → validación → escritura
  // condicional al stock leído (candado optimista) → alta del movimiento.
  let movement: {
    id: number; type: StockMoveType; quantity: unknown; balanceAfter: unknown;
    unitCost: unknown; supplier: string | null; reasonCode: string | null; reason: string | null; createdAt: Date;
    createdBy: { fullName: string };
  };
  try {
    movement = await prisma.$transaction(async (tx) => {
      const fresh = await tx.stockItem.findFirst({ where: { id, tenantId: TENANT }, select: { stock: true } });
      if (!fresh) throw Object.assign(new Error("no encontrado"), { httpStatus: 404, clientMessage: "Producto no encontrado" });

      const current = Number(fresh.stock);
      const v = validateMovement({ type, quantity, reasonCode, reason, currentStock: current });
      if (!v.ok) throw Object.assign(new Error("inválido"), { httpStatus: 400, clientMessage: v.error });

      const balance = nextBalance(current, type, quantity);

      const upd = await tx.stockItem.updateMany({
        where: { id, stock: fresh.stock },
        data: { stock: balance, ...(type === "ENTRADA" && unitCost != null ? { lastCost: unitCost } : {}) },
      });
      if (upd.count === 0) {
        throw Object.assign(new Error("conflicto"), { httpStatus: 409, clientMessage: "El stock cambió mientras registrabas. Vuelve a intentarlo." });
      }

      return tx.stockMovement.create({
        data: {
          tenantId: TENANT,
          itemId: id,
          type,
          quantity,
          balanceAfter: balance,
          unitCost: isEntrada ? unitCost : null,
          supplier: isEntrada ? supplier : null,
          reasonCode,
          reason: reason || null,
          createdById: s.staffId as number,
        },
        select: {
          id: true, type: true, quantity: true, balanceAfter: true, unitCost: true,
          supplier: true, reasonCode: true, reason: true, createdAt: true, createdBy: { select: { fullName: true } },
        },
      });
    });
  } catch (e) {
    const meta = typeof e === "object" && e !== null ? (e as { httpStatus?: unknown; clientMessage?: unknown }) : {};
    const httpStatus = typeof meta.httpStatus === "number" ? meta.httpStatus : 500;
    // Lo inesperado (500) devuelve un mensaje fijo y NUNCA el texto del error; los errores
    // mapeados llevan su mensaje al cliente en `clientMessage` (no se lee `e` crudo).
    const message = httpStatus === 500 || typeof meta.clientMessage !== "string"
      ? "No se pudo registrar el movimiento"
      : meta.clientMessage;
    if (httpStatus === 500) console.error("[almacen/movements] transacción falló", e);
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: httpStatus });
  }

  // Aviso a Manager en MERMA y AJUSTE (dejan de moverse cantidades sin que nadie mire).
  if (type === "MERMA" || type === "AJUSTE") {
    const detalle = type === "AJUSTE" ? `quedó en ${round3(quantity)}` : `− ${round3(quantity)}`;
    void notify({
      roles: ["MANAGER"],
      type: "audit",
      title: type === "MERMA" ? "Merma en almacén" : "Ajuste de almacén",
      body: `${item.name} · ${detalle} ${item.unit} · ${reasonCode} · por ${movement.createdBy.fullName}${reason ? ` · ${reason}` : ""}`,
      url: "/staff/almacen",
    });
  }

  const updatedItem = await prisma.stockItem.findFirst({
    where: { id, tenantId: TENANT },
    select: {
      id: true, tenantId: true, categoryId: true, name: true, unit: true, stock: true,
      minStock: true, lastCost: true, notes: true, position: true, active: true,
      archivedAt: true, createdAt: true, updatedAt: true,
    },
  });
  const itemStock = updatedItem ? Number(updatedItem.stock) : 0;
  const itemMin = updatedItem?.minStock != null ? Number(updatedItem.minStock) : null;

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      item: updatedItem && {
        ...updatedItem,
        stock: itemStock,
        minStock: itemMin,
        lastCost: updatedItem.lastCost != null ? Number(updatedItem.lastCost) : null,
        low: itemMin != null && itemStock < itemMin,
      },
      movement: {
        id: movement.id,
        type: movement.type,
        quantity: Number(movement.quantity),
        balanceAfter: Number(movement.balanceAfter),
        unitCost: movement.unitCost != null ? Number(movement.unitCost) : null,
        supplier: movement.supplier,
        reasonCode: movement.reasonCode,
        reason: movement.reason,
        createdAt: movement.createdAt,
        createdBy: { fullName: movement.createdBy.fullName },
      },
    },
  }, { status: 201 });
}
