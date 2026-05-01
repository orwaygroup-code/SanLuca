import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function isAdmin(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return false;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return u?.role === "ADMIN";
}

function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date();
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart   = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd     = monthStart;

  const [newUsers, prevUsers, newRes, prevRes] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.user.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } }),
    prisma.reservation.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.reservation.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } }),
  ]);

  // Conversion rate: confirmed + completed vs total reservations this month
  const [resByStatus, totalRes] = await Promise.all([
    prisma.reservation.groupBy({
      by: ["status"],
      where: { createdAt: { gte: monthStart } },
      _count: true,
    }),
    prisma.reservation.count({ where: { createdAt: { gte: monthStart } } }),
  ]);
  const cancelled = resByStatus.find((r) => r.status === "CANCELLED")?._count ?? 0;
  const noShow    = resByStatus.find((r) => r.status === "NO_SHOW")?._count ?? 0;
  const completed = resByStatus.find((r) => r.status === "COMPLETED")?._count ?? 0;
  const confirmed = resByStatus.find((r) => r.status === "CONFIRMED")?._count ?? 0;
  const successful = completed + confirmed;
  const conversionPct = totalRes > 0 ? Math.round((successful / totalRes) * 100) : 0;

  // Last 7 days reservations grouped by weekday
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const weekRes = await prisma.reservation.findMany({
    where: { createdAt: { gte: weekStart } },
    select: { createdAt: true },
  });
  const days = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return { label: days[d.getDay()], date: d, count: 0 };
  });
  for (const r of weekRes) {
    const idx = Math.floor((r.createdAt.getTime() - weekStart.getTime()) / (24 * 3600 * 1000));
    if (idx >= 0 && idx < 7) buckets[idx].count += 1;
  }

  return NextResponse.json({
    cards: {
      users:    { value: newUsers, growth: pct(newUsers, prevUsers) },
      // Mensajes whatsapp = MOCK hasta tener fuente
      messages: { value: 0,        growth: 0,                          mock: true },
      reservations: { value: newRes, growth: pct(newRes, prevRes) },
    },
    chart: buckets.map((b) => ({ label: b.label, value: b.count })),
    conversion: {
      pct: conversionPct,
      total: totalRes,
      successful,
      cancelled: cancelled + noShow,
    },
  });
}
