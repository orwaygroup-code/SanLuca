import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const detailSelect = {
  id: true, status: true, date: true, guests: true, duration: true,
  guestName: true, guestPhone: true,
  sectionPreference: true, occasion: true, notes: true,
  isLargeGroup: true, requiresPayment: true,
  paymentStatus: true, amountPaid: true, creditUsed: true,
  createdAt: true, confirmedAt: true, cancelledAt: true, cancelReason: true,
  checkedInAt: true,
  table:        { select: { number: true, section: { select: { name: true } } } },
  linkedTable:  { select: { number: true } },
  thirdTable:   { select: { number: true } },
  fourthTable:  { select: { number: true } },
} satisfies Prisma.ReservationSelect;

async function isAdmin(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return false;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return u?.role === "ADMIN";
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search   = searchParams.get("search") ?? "";
  const source   = searchParams.get("source") ?? "todos"; // todos | web | whatsapp
  const detailId = searchParams.get("id");

  if (detailId) return NextResponse.json(await getUserDetail(detailId));

  // Usuarios que han CREADO al menos 1 reserva (incluye staff que reservó por terceros)
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { createdReservations: { some: {} } },
        { reservations:        { some: {} } }, // fallback para data antigua sin createdById
      ],
      ...(source === "web"      ? { source: "WEB" }      : {}),
      ...(source === "whatsapp" ? { source: "WHATSAPP" } : {}),
      ...(search
        ? {
            AND: [{
              OR: [
                { name:  { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
              ],
            }],
          }
        : {}),
    },
    select: {
      id: true, name: true, email: true, phone: true,
      googleId: true, source: true, role: true, createdAt: true,
      _count: { select: { createdReservations: true, reservations: true } },
    },
    take: 200,
  });

  // Sort por # creadas desc (incluye fallback a reservations cuando createdById es null)
  users.sort((a, b) => {
    const aTotal = a._count.createdReservations || a._count.reservations;
    const bTotal = b._count.createdReservations || b._count.reservations;
    const c = bTotal - aTotal;
    return c !== 0 ? c : b.createdAt.getTime() - a.createdAt.getTime();
  });

  // Counters por canal
  const baseOr = [
    { createdReservations: { some: {} } },
    { reservations:        { some: {} } },
  ];
  const [totalAll, totalWeb, totalWa] = await Promise.all([
    prisma.user.count({ where: { OR: baseOr } }),
    prisma.user.count({ where: { OR: baseOr, source: "WEB" } }),
    prisma.user.count({ where: { OR: baseOr, source: "WHATSAPP" } }),
  ]);

  return NextResponse.json({
    counts: { todos: totalAll, web: totalWeb, whatsapp: totalWa },
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      visits: u._count.reservations,
      source: u.source.toLowerCase(),
      login:  u.googleId ? "google" : "email",
      role:   u.role,
      createdAt: u.createdAt,
    })),
  });
}

async function getUserDetail(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, phone: true, googleId: true, source: true, role: true, createdAt: true,
      // Mostramos las reservas que el usuario CREÓ (incluye las hechas por staff a nombre de otros)
      // + fallback a las que es dueño (data antigua sin createdById).
      createdReservations: {
        select: detailSelect,
        orderBy: { date: "desc" },
      },
      reservations: {
        select: detailSelect,
        orderBy: { date: "desc" },
      },
    },
  });
  if (!user) return { error: "not_found" };

  // Si tiene createdReservations usamos esas; si no (data antigua) caemos a las owned.
  const list = user.createdReservations.length > 0 ? user.createdReservations : user.reservations;

  const totalVisits = list.length;
  const confirmed   = list.filter((r) => ["CONFIRMED", "COMPLETED", "IN_PROGRESS"].includes(r.status)).length;
  const cancelled   = list.filter((r) => r.status === "CANCELLED").length;
  const noShow      = list.filter((r) => r.status === "NO_SHOW").length;

  const secCount: Record<string, number> = {};
  const occCount: Record<string, number> = {};
  for (const r of list) {
    if (r.sectionPreference) secCount[r.sectionPreference] = (secCount[r.sectionPreference] || 0) + 1;
    if (r.occasion)          occCount[r.occasion]          = (occCount[r.occasion]          || 0) + 1;
  }
  const sortKv = (o: Record<string, number>) =>
    Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v }));

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      source: user.source.toLowerCase(),
      login:  user.googleId ? "google" : "email",
      createdAt: user.createdAt,
    },
    stats: {
      totalVisits,
      confirmed,
      cancelled: cancelled + noShow,
      lastReservation: user.reservations[0]?.date ?? null,
    },
    preferences: {
      sections: sortKv(secCount).slice(0, 3),
      occasions: sortKv(occCount).slice(0, 3),
    },
    reservations: user.reservations.map((r) => ({
      id: r.id,
      status: r.status,
      date: r.date,
      guests: r.guests,
      duration: r.duration,
      guestName: r.guestName,
      guestPhone: r.guestPhone,
      sectionPreference: r.sectionPreference,
      occasion: r.occasion,
      notes: r.notes,
      isLargeGroup: r.isLargeGroup,
      requiresPayment: r.requiresPayment,
      paymentStatus: r.paymentStatus,
      amountPaid: r.amountPaid ? Number(r.amountPaid) : 0,
      creditUsed: r.creditUsed,
      createdAt: r.createdAt,
      confirmedAt: r.confirmedAt,
      cancelledAt: r.cancelledAt,
      cancelReason: r.cancelReason,
      checkedInAt: r.checkedInAt,
      tables: [r.table?.number, r.linkedTable?.number, r.thirdTable?.number, r.fourthTable?.number].filter(Boolean) as number[],
      tableSection: r.table?.section.name ?? null,
    })),
  };
}
