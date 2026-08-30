// app/api/bot/pedido/route.ts
// Pedido PARA LLEVAR creado por el bot (WhatsApp / Instagram / Messenger).
// Crea una Comanda SIN mesa (igual que las "cuentas sin mesa" de Perla), con
// los items matcheados por id de platillo → entra al mismo flujo de "Llevar",
// cocina y caja. Pago al recoger (Perla la cobra). Requiere header x-bot-key.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getShiftWindow } from "@/lib/shifts";
import { formatFolio } from "@/lib/comandaRules";
import { lineTotal as calcLineTotal } from "@/lib/comandaTotals";
import { TENANT, COMANDA_INCLUDE, recalcComandaTotals, isUniqueViolation } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

const MX_TZ = "America/Mexico_City";
function mxYear(): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: MX_TZ, year: "numeric" }).format(new Date()));
}

const CHANNEL_BY_PLATFORM: Record<string, string> = {
  whatsapp: "BOT_WHATSAPP",
  instagram: "BOT_INSTAGRAM",
  messenger: "BOT_MESSENGER",
};

// Arma un texto legible de recolección desde la fecha/hora que dio el cliente al bot,
// SIN parsear a Date (evita bugs de zona horaria): "04/08/2026"+"14:00" -> "4 ago · 2:00 PM".
const MESES_MX = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function formatPickup(fecha?: unknown, hora?: unknown): string | null {
  const parts: string[] = [];
  const fm = String(fecha ?? "").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (fm) parts.push(`${Number(fm[1])} ${MESES_MX[Number(fm[2]) - 1] ?? fm[2]}`);
  else if (fecha && String(fecha).trim()) parts.push(String(fecha).trim());
  const hm = String(hora ?? "").match(/(\d{1,2}):(\d{2})/);
  if (hm) {
    const h = Number(hm[1]);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = ((h + 11) % 12) + 1;
    parts.push(`${h12}:${hm[2]} ${ampm}`);
  } else if (hora && String(hora).trim()) parts.push(String(hora).trim());
  const out = parts.join(" · ");
  return out.length ? out : null;
}

interface Producto {
  id?: string; cantidad?: number; quantity?: number; notas?: string;
  nombre?: string; nombre_platillo?: string; precio_unitario?: number; precio?: number;
}

type DishRow = { id: string; name: string; price: unknown; prepArea: "BARRA" | "COCINA" | null };

// Convierte un nombre en un CONJUNTO de palabras para comparar: minúsculas, sin
// acentos, y todo lo no alfanumérico (paréntesis, apóstrofos, puntuación) pasa a
// separador — PERO se conserva el contenido del paréntesis como palabra. Así el menú
// que usa "Frutti di Mare (Pizza)" vs "(Pasta)" para distinguir sí se puede separar:
// "Pizza Frutti di Mare" -> {pizza,frutti,di,mare} == "Frutti di Mare (Pizza)".
function toTokenSet(s: string): Set<string> {
  return new Set(
    String(s)
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean),
  );
}
function setEq(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
// ¿`small` está contenido en `big`? (todas sus palabras están en el otro)
function subsetOf(small: Set<string>, big: Set<string>): boolean {
  if (small.size === 0) return false;
  for (const x of small) if (!big.has(x)) return false;
  return true;
}

export async function POST(request: NextRequest) {
  const botKey = request.headers.get("x-bot-key");
  if (!botKey || botKey !== process.env.BOT_API_KEY) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { titular, celular, productos, notas, fecha, hora, plataforma, wa_phone } = body || {};

  // Resumen sin datos personales: `titular`, `celular` y `wa_phone` identifican
  // al comensal, y estos registros quedan en disco del servidor vía PM2.
  console.log(
    `[BOT_PEDIDO] body recibido: productos=${Array.isArray(productos) ? productos.length : 0}` +
    ` fecha=${fecha ?? "-"} hora=${hora ?? "-"} plataforma=${plataforma ?? "-"}` +
    ` notas=${notas ? "sí" : "no"}`
  );

  const name = typeof titular === "string" ? titular.trim() : "";
  if (!name) return NextResponse.json<ApiResponse>({ success: false, error: "Falta el nombre (titular)" }, { status: 400 });
  if (!Array.isArray(productos) || productos.length === 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "El pedido no trae productos" }, { status: 400 });
  }

  const channel = CHANNEL_BY_PLATFORM[String(plataforma || "whatsapp").toLowerCase()] ?? "BOT_WHATSAPP";

  // Dueño de la comanda: primer OPERATION/CAPTAIN/MANAGER activo (Perla). El bot
  // no tiene sesión de staff, así que la comanda se abre a nombre de caja.
  const owner = await prisma.staff.findFirst({
    where: { tenantId: TENANT, active: true, role: { in: ["OPERATION", "CAPTAIN", "MANAGER"] } },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!owner) return NextResponse.json<ApiResponse>({ success: false, error: "No hay caja/operación activa para asignar el pedido" }, { status: 500 });

  // El "mesero" de una cuenta para llevar es el de sistema "Llevar" → no genera punto (7%)
  // para nadie. Perla (owner) queda como quien la atiende (openedById/addedById). Si el
  // staff "llevar" no existe aún (seed no corrido), cae a owner para no romper.
  const llevar = await prisma.staff.findUnique({ where: { username: "llevar" }, select: { id: true } });
  const llevarWaiterId = llevar?.id ?? owner.id;

  // Match de productos: 1º por id de platillo; si el bot NO mandó id (arma el pedido
  // por la rama sin menú inyectado), 2º por NOMBRE normalizado contra el catálogo
  // activo. Solo platillos ACTIVOS y con área de preparación. Lo que no matchee o sea
  // ambiguo se anota para que Perla lo revise (mejor anotar que adivinar mal).
  const ids = [...new Set((productos as Producto[]).map((p) => String(p?.id ?? "")).filter(Boolean))];
  const byIdList = ids.length
    ? await prisma.dish.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, name: true, price: true, prepArea: true } })
    : [];
  const dishById = new Map(byIdList.map((d) => [d.id, d as DishRow]));

  // ¿Algún producto no se resolvió por id? Cargamos el catálogo activo UNA vez para el
  // fallback por nombre (no lo traemos si todos venían con id válido).
  const needName = (productos as Producto[]).some((p) => !(p?.id && dishById.has(String(p.id))));
  let nameIndex: { set: Set<string>; d: DishRow }[] = [];
  if (needName) {
    const all = await prisma.dish.findMany({
      where: { active: true, prepArea: { not: null } },
      select: { id: true, name: true, price: true, prepArea: true },
    });
    nameIndex = all.map((d) => ({ set: toTokenSet(d.name), d: d as DishRow }));
  }

  const resolveDish = (p: Producto): DishRow | undefined => {
    if (p?.id && dishById.has(String(p.id))) return dishById.get(String(p.id));
    const raw = p?.nombre ?? p?.nombre_platillo;
    if (!raw || nameIndex.length === 0) return undefined;
    const q = toTokenSet(String(raw));
    if (q.size === 0) return undefined;
    const price = Number(p?.precio_unitario ?? p?.precio);
    const hasPrice = Number.isFinite(price);
    // De una lista de candidatos: si es 1, ese; si son varios, desempata por precio.
    const pick = (cands: typeof nameIndex): DishRow | undefined => {
      if (cands.length === 1) return cands[0].d;
      if (cands.length > 1 && hasPrice) {
        const byPrice = cands.filter((x) => Math.abs(Number(x.d.price) - price) < 0.01);
        if (byPrice.length === 1) return byPrice[0].d;
      }
      return undefined; // ambiguo → Perla lo revisa
    };
    // 1) mismo conjunto de palabras (ej. "Pizza Frutti di Mare" == "Frutti di Mare (Pizza)")
    const exact = pick(nameIndex.filter((x) => setEq(x.set, q)));
    if (exact) return exact;
    // 2) el nombre del menú está contenido en el del bot, o viceversa (ej. "Caprese" ⊆ "Ensalada Caprese")
    return pick(nameIndex.filter((x) => subsetOf(x.set, q) || subsetOf(q, x.set)));
  };

  const items: { dishId: string; name: string; price: number; prepArea: "BARRA" | "COCINA"; qty: number; kitchenNotes: string | null; line: number }[] = [];
  const sinMatch: string[] = [];
  for (const p of productos as Producto[]) {
    const d = resolveDish(p);
    const qty = Math.min(999, Math.round((Number(p?.cantidad ?? p?.quantity ?? 1) || 1) * 100) / 100);
    if (!d || !d.prepArea) { sinMatch.push(`${p?.nombre ?? p?.id ?? "?"}${p?.notas ? " (" + p.notas + ")" : ""}`); continue; }
    items.push({
      dishId: d.id, name: d.name, price: Number(d.price), prepArea: d.prepArea, qty,
      kitchenNotes: typeof p?.notas === "string" && p.notas.trim() ? p.notas.trim() : null,
      line: calcLineTotal(Number(d.price), qty, 0),
    });
  }

  console.log(`[BOT_PEDIDO] resultado: matched=${items.length} (${items.map((i) => i.name).join(", ")}) | sinMatch=${JSON.stringify(sinMatch)}`);

  if (items.length === 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Ninguno de los productos existe o está disponible" }, { status: 422 });
  }

  // Nota visible para Perla: contacto + recolección + productos que no matchearon.
  const notesLines = [
    `Tel: ${typeof celular === "string" && celular.trim() ? celular.trim() : (wa_phone ?? "—")}`,
    fecha || hora ? `Recoge: ${fecha ?? ""} ${hora ?? ""}`.trim() : null,
    `Vía: ${plataforma ?? "whatsapp"}`,
    typeof notas === "string" && notas.trim() ? `Nota: ${notas.trim()}` : null,
    sinMatch.length ? `⚠ Sin match (revisar): ${sinMatch.join(", ")}` : null,
  ].filter(Boolean);

  const pickupNote = formatPickup(fecha, hora); // "4 ago · 2:00 PM" — para mostrarle a Perla.

  const shift = getShiftWindow(new Date()).name;
  const year = mxYear();
  let seq = (await prisma.comanda.count({ where: { tenantId: TENANT, folio: { startsWith: `COM-${year}-` } } })) + 1;

  // Crea la comanda con reintento de folio, luego los items, luego recalcula totales.
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const comanda = await prisma.comanda.create({
        data: {
          tenantId: TENANT,
          tableId: null,
          customName: `Para llevar · ${name}`.slice(0, 80),
          channel,
          pickupNote,
          guestsActual: 1,
          waiterId: llevarWaiterId,
          openedById: owner.id,
          shift,
          notes: notesLines.join(" · ").slice(0, 500),
          folio: formatFolio(year, seq),
        },
        select: { id: true, folio: true },
      });

      await prisma.comandaItem.createMany({
        data: items.map((it) => ({
          tenantId: TENANT,
          comandaId: comanda.id,
          dishId: it.dishId,
          dishNameSnapshot: it.name,
          unitPriceSnapshot: it.price,
          prepAreaSnapshot: it.prepArea,
          quantity: it.qty,
          course: 1,
          modifiersExtraCost: 0,
          kitchenNotes: it.kitchenNotes,
          lineTotal: it.line,
          addedById: owner.id,
        })),
      });

      await recalcComandaTotals(comanda.id);
      const full = await prisma.comanda.findFirst({ where: { id: comanda.id, tenantId: TENANT }, include: COMANDA_INCLUDE });

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          id: comanda.id,
          folio: comanda.folio,
          matched: items.length,
          sinMatch,
          total: full ? Number(full.total) : null,
        },
      }, { status: 201 });
    } catch (e) {
      if (isUniqueViolation(e)) { seq++; continue; } // colisión de folio → reintentar
      console.error("[API] POST /api/bot/pedido error:", e);
      return NextResponse.json<ApiResponse>({ success: false, error: "Error al registrar el pedido" }, { status: 500 });
    }
  }
  return NextResponse.json<ApiResponse>({ success: false, error: "No se pudo generar folio único" }, { status: 500 });
}
