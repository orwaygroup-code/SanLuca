import { NextRequest, NextResponse } from "next/server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { requireAdmin } from "@/lib/auth-server";

function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export async function GET(req: NextRequest) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return runWithSession(s, async () => {
    const now = new Date();
    const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart   = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd     = monthStart;

    return withApp(async (db) => {
      const [newUsers, prevUsers, newRes, prevRes, newMsgs, prevMsgs] = await Promise.all([
        db.user.count({ where: { createdAt: { gte: monthStart } } }),
        db.user.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } }),
        db.reservation.count({ where: { createdAt: { gte: monthStart } } }),
        db.reservation.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } }),
        db.whatsAppMessage.count({ where: { createdAt: { gte: monthStart }, direction: "INBOUND" } }),
        db.whatsAppMessage.count({ where: { createdAt: { gte: prevStart, lt: prevEnd }, direction: "INBOUND" } }),
      ]);

      const [resByStatus, totalRes] = await Promise.all([
        db.reservation.groupBy({
          by: ["status"],
          where: { createdAt: { gte: monthStart } },
          _count: true,
        }),
        db.reservation.count({ where: { createdAt: { gte: monthStart } } }),
      ]);
      const cancelled = resByStatus.find((r) => r.status === "CANCELLED")?._count ?? 0;
      const noShow    = resByStatus.find((r) => r.status === "NO_SHOW")?._count ?? 0;
      const completed = resByStatus.find((r) => r.status === "COMPLETED")?._count ?? 0;
      const confirmed = resByStatus.find((r) => r.status === "CONFIRMED")?._count ?? 0;
      const successful = completed + confirmed;
      const conversionPct = totalRes > 0 ? Math.round((successful / totalRes) * 100) : 0;

      // ── Conversión WhatsApp ──
      // Total = conversaciones únicas (cada phone es una conversación)
      // Convertidas = phones que tienen al menos 1 reserva con source=WHATSAPP este mes
      const totalWaConvs = await db.whatsAppConversation.count({
        where: { createdAt: { gte: monthStart } },
      });
      const convertedRows = await db.reservation.findMany({
        where: {
          source: "WHATSAPP",
          status: { in: ["CONFIRMED", "COMPLETED", "IN_PROGRESS", "PENDING"] },
          createdAt: { gte: monthStart },
        },
        select: { guestPhone: true },
        distinct: ["guestPhone"],
      });
      const convertedWa = convertedRows.length;
      const waConversionPct = totalWaConvs > 0 ? Math.round((convertedWa / totalWaConvs) * 100) : 0;

      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      const weekRes = await db.reservation.findMany({
        where: { createdAt: { gte: weekStart } },
        select: { createdAt: true },
      });
      const days = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
      const buckets = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return { label: days[d.getDay()], dayOfWeek: d.getDay(), count: 0 };
      });
      for (const r of weekRes) {
        const idx = Math.floor((r.createdAt.getTime() - weekStart.getTime()) / (24 * 3600 * 1000));
        if (idx >= 0 && idx < 7) buckets[idx].count += 1;
      }
      // San Luca no abre los lunes — se omite de la gráfica
      const chart = buckets.filter((b) => b.dayOfWeek !== 1);

      return NextResponse.json({
        cards: {
          users:        { value: newUsers, growth: pct(newUsers, prevUsers) },
          messages:     { value: newMsgs,  growth: pct(newMsgs,  prevMsgs)  },
          reservations: { value: newRes,   growth: pct(newRes,   prevRes)   },
        },
        chart: chart.map((b) => ({ label: b.label, value: b.count })),
        conversion: {
          pct: conversionPct,
          total: totalRes,
          successful,
          cancelled: cancelled + noShow,
        },
        whatsappConversion: {
          pct: waConversionPct,
          totalConversations: totalWaConvs,
          converted: convertedWa,
        },
      });
    });
  });
}
