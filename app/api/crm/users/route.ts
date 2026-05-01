import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  const channel  = searchParams.get("channel") ?? "todos"; // todos | google | email
  const detailId = searchParams.get("id");

  if (detailId) return NextResponse.json(await getUserDetail(detailId));

  const users = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      ...(channel === "google" ? { googleId: { not: null } } : {}),
      ...(channel === "email"  ? { googleId: null,  passwordHash: { not: null } } : {}),
      ...(search
        ? {
            OR: [
              { name:  { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, phone: true,
      googleId: true, createdAt: true,
      _count: { select: { reservations: true } },
    },
    take: 100,
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      visits: u._count.reservations,
      channel: u.googleId ? "google" : "email",
      createdAt: u.createdAt,
    })),
  });
}

async function getUserDetail(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, phone: true, googleId: true, createdAt: true,
      reservations: {
        select: { id: true, status: true, date: true, occasion: true, sectionPreference: true, guests: true, notes: true },
        orderBy: { date: "desc" },
      },
    },
  });
  if (!user) return { error: "not_found" };

  const totalVisits  = user.reservations.length;
  const confirmed    = user.reservations.filter((r) => ["CONFIRMED", "COMPLETED", "IN_PROGRESS"].includes(r.status)).length;
  const cancelled    = user.reservations.filter((r) => r.status === "CANCELLED").length;
  const noShow       = user.reservations.filter((r) => r.status === "NO_SHOW").length;

  // Preferencias derivadas — sección + occasion más frecuentes
  const secCount: Record<string, number> = {};
  const occCount: Record<string, number> = {};
  for (const r of user.reservations) {
    if (r.sectionPreference) secCount[r.sectionPreference] = (secCount[r.sectionPreference] || 0) + 1;
    if (r.occasion)          occCount[r.occasion]          = (occCount[r.occasion]          || 0) + 1;
  }
  const sortKv = (o: Record<string, number>) =>
    Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v }));

  // Última actividad
  const lastReservation = user.reservations[0];

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      channel: user.googleId ? "google" : "email",
      createdAt: user.createdAt,
    },
    stats: {
      totalVisits,
      confirmed,
      cancelled: cancelled + noShow,
      lastReservation: lastReservation?.date ?? null,
    },
    preferences: {
      sections: sortKv(secCount).slice(0, 3),
      occasions: sortKv(occCount).slice(0, 3),
    },
    recent: user.reservations.slice(0, 5).map((r) => ({
      id: r.id, status: r.status, date: r.date, occasion: r.occasion, section: r.sectionPreference, guests: r.guests, notes: r.notes,
    })),
  };
}
