import { NextRequest, NextResponse } from "next/server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { requireAdmin } from "@/lib/auth-server";

/**
 * Inbox de "conversaciones" derivadas: usuarios cuyo `source=WHATSAPP`,
 * agrupados por última reserva.
 *
 * Probabilidad de cierre = heurística simple basada en ratio reservas
 * confirmadas/totales y recencia. Reemplazar cuando exista lógica del bot.
 */
export async function GET(req: NextRequest) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return runWithSession(s, async () => {
  const users = await withApp((db) => db.user.findMany({
    where: { role: "CUSTOMER", source: "WHATSAPP" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, name: true, phone: true,
      reservations: {
        select: { status: true, occasion: true, date: true, createdAt: true },
        orderBy: { date: "desc" },
        take: 1,
      },
      _count: { select: { reservations: true } },
    },
    take: 100,
  }));

  const rows = users.map((u) => {
    const last = u.reservations[0];
    const total      = u._count.reservations;
    const succeeded  = last && ["CONFIRMED", "COMPLETED"].includes(last.status) ? 1 : 0;
    const cancelled  = last?.status === "CANCELLED" || last?.status === "NO_SHOW";

    // Heurística de probabilidad
    let prob = 50;
    if (total === 0)        prob = 20; // solo escribió
    else if (succeeded)     prob = 80;
    else if (cancelled)     prob = 25;
    else if (last?.status === "PENDING_PAYMENT") prob = 60;

    // Status visible
    let status: "CLIENTE" | "ASESORIA" | "FIDELIZADO" | "ESPECTADOR" | "POR CERRAR" = "ESPECTADOR";
    if (total >= 3 && succeeded)             status = "FIDELIZADO";
    else if (succeeded)                      status = "CLIENTE";
    else if (last?.status === "PENDING_PAYMENT") status = "POR CERRAR";
    else if (last)                           status = "ASESORIA";

    return {
      id: u.id,
      phone: u.phone || "—",
      name: u.name,
      probability: prob,
      topic: last?.occasion ?? (last ? "Reservación" : "Informativo"),
      status,
      lastDate: last?.date ?? null,
      totalReservations: total,
    };
  });

  return NextResponse.json({ rows, totalUsers: rows.length });
  });
}
