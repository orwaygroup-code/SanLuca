import { NextRequest, NextResponse } from "next/server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { requireAdmin } from "@/lib/auth-server";

// ── Query params ─────────────────────────────────────────────────
//   period  = "month" | "year" | "day"   (default: month)
//   value   = "YYYY-MM" | "YYYY" | "YYYY-MM-DD"  (según period; default: actual)
//   days    = "0,2,3,4,5,6"   (DOW JS/Postgres 0=Dom...6=Sab; default sin lunes)
//   source  = "all" | "WHATSAPP" | "WEB"  (default: all)

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

type Period = "month" | "year" | "day";

function parseRange(period: Period, value: string | null): {
  start: Date;
  end:   Date;
  prevStart: Date;
  prevEnd:   Date;
} {
  const now = new Date();
  if (period === "year") {
    const y = value ? parseInt(value, 10) : now.getFullYear();
    return {
      start:     new Date(y,     0, 1),
      end:       new Date(y + 1, 0, 1),
      prevStart: new Date(y - 1, 0, 1),
      prevEnd:   new Date(y,     0, 1),
    };
  }
  if (period === "day") {
    const d = value ? new Date(`${value}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const prev = new Date(d); prev.setDate(d.getDate() - 1);
    return { start: d, end: next, prevStart: prev, prevEnd: d };
  }
  // month
  let y = now.getFullYear(), m = now.getMonth();
  if (value) {
    const [yy, mm] = value.split("-").map((x) => parseInt(x, 10));
    if (!isNaN(yy) && !isNaN(mm)) { y = yy; m = mm - 1; }
  }
  return {
    start:     new Date(y, m,     1),
    end:       new Date(y, m + 1, 1),
    prevStart: new Date(y, m - 1, 1),
    prevEnd:   new Date(y, m,     1),
  };
}

export async function GET(req: NextRequest) {
  const s = await requireAdmin(req);
  if (!s) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const period = (sp.get("period") as Period) || "month";
  const value  = sp.get("value");
  const daysParam = sp.get("days");
  const allowedDays = daysParam
    ? daysParam.split(",").map((x) => parseInt(x, 10)).filter((n) => !isNaN(n) && n >= 0 && n <= 6)
    : [0, 2, 3, 4, 5, 6]; // default: todos menos lunes
  const source = (sp.get("source") || "all").toUpperCase();
  const sourceFilter = source === "WHATSAPP" || source === "WEB" ? source : null;

  const { start, end, prevStart, prevEnd } = parseRange(period, value);

  return runWithSession(s, async () => {
    return withApp(async (db) => {
      // ── Filtros base ───────────────────────────────────────────
      const resWhere = (gte: Date, lt: Date) => ({
        createdAt: { gte, lt },
        ...(sourceFilter ? { source: sourceFilter as "WHATSAPP" | "WEB" } : {}),
      });

      // Para usuarios y mensajes el filtro de "source" no aplica directamente,
      // pero respetamos el filtro de fechas y de día-de-semana en memoria.

      const [newUsersRows, prevUsersRows, newResRows, prevResRows, newMsgsRows, prevMsgsRows] = await Promise.all([
        db.user.findMany({ where: { createdAt: { gte: start,     lt: end     } }, select: { createdAt: true } }),
        db.user.findMany({ where: { createdAt: { gte: prevStart, lt: prevEnd } }, select: { createdAt: true } }),
        db.reservation.findMany({ where: resWhere(start,     end),     select: { createdAt: true, status: true, source: true } }),
        db.reservation.findMany({ where: resWhere(prevStart, prevEnd), select: { createdAt: true } }),
        db.whatsAppMessage.findMany({ where: { createdAt: { gte: start,     lt: end     }, direction: "INBOUND" }, select: { createdAt: true } }),
        db.whatsAppMessage.findMany({ where: { createdAt: { gte: prevStart, lt: prevEnd }, direction: "INBOUND" }, select: { createdAt: true } }),
      ]);

      const dowOk = (d: Date) => allowedDays.includes(d.getDay());

      const newUsers = newUsersRows.filter((r) => dowOk(r.createdAt)).length;
      const prevUsers = prevUsersRows.filter((r) => dowOk(r.createdAt)).length;
      const newResFiltered = newResRows.filter((r) => dowOk(r.createdAt));
      const prevRes = prevResRows.filter((r) => dowOk(r.createdAt)).length;
      const newMsgs = newMsgsRows.filter((r) => dowOk(r.createdAt)).length;
      const prevMsgs = prevMsgsRows.filter((r) => dowOk(r.createdAt)).length;

      const newRes = newResFiltered.length;

      // ── Conversión general ────────────────────────────────────
      const cancelled = newResFiltered.filter((r) => r.status === "CANCELLED").length;
      const noShow    = newResFiltered.filter((r) => r.status === "NO_SHOW").length;
      const completed = newResFiltered.filter((r) => r.status === "COMPLETED").length;
      const confirmed = newResFiltered.filter((r) => r.status === "CONFIRMED").length;
      const successful = completed + confirmed;
      const conversionPct = newRes > 0 ? Math.round((successful / newRes) * 100) : 0;

      // ── Conversión WhatsApp ───────────────────────────────────
      // Total = conversaciones únicas en el período (filtradas por DOW)
      // Convertidas = phones distintos con reserva WHATSAPP exitosa en el período
      const waConvRows = await db.whatsAppConversation.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: { createdAt: true },
      });
      const totalWaConvs = waConvRows.filter((r) => dowOk(r.createdAt)).length;

      const convertedRows = await db.reservation.findMany({
        where: {
          source: "WHATSAPP",
          status: { in: ["CONFIRMED", "COMPLETED", "IN_PROGRESS", "PENDING"] },
          createdAt: { gte: start, lt: end },
        },
        select: { guestPhone: true, createdAt: true },
      });
      const convertedSet = new Set(
        convertedRows.filter((r) => dowOk(r.createdAt)).map((r) => r.guestPhone),
      );
      const convertedWa = convertedSet.size;
      const waConversionPct = totalWaConvs > 0 ? Math.round((convertedWa / totalWaConvs) * 100) : 0;

      // ── Gráfica ────────────────────────────────────────────────
      // year  → 12 barras (meses)
      // month → barras por día del mes
      // day   → 1 barra (total del día)
      let chart: { label: string; value: number }[] = [];

      if (period === "year") {
        const y = start.getFullYear();
        const buckets = Array.from({ length: 12 }, (_, m) => ({ label: MONTH_LABELS[m], count: 0 }));
        for (const r of newResFiltered) {
          if (r.createdAt.getFullYear() === y) buckets[r.createdAt.getMonth()].count += 1;
        }
        chart = buckets.map((b) => ({ label: b.label, value: b.count }));
      } else if (period === "day") {
        chart = [{ label: DAY_LABELS[start.getDay()], value: newRes }];
      } else {
        // month → un bar por día (omitiendo días no permitidos)
        const y = start.getFullYear(), m = start.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const buckets: { label: string; dayOfWeek: number; count: number }[] = [];
        for (let day = 1; day <= daysInMonth; day++) {
          const d = new Date(y, m, day);
          if (!dowOk(d)) continue;
          buckets.push({ label: String(day), dayOfWeek: d.getDay(), count: 0 });
        }
        for (const r of newResFiltered) {
          const d = r.createdAt;
          if (d.getFullYear() !== y || d.getMonth() !== m) continue;
          const idx = buckets.findIndex((b) => parseInt(b.label, 10) === d.getDate());
          if (idx >= 0) buckets[idx].count += 1;
        }
        chart = buckets.map((b) => ({ label: b.label, value: b.count }));
      }

      return NextResponse.json({
        cards: {
          users:        { value: newUsers, growth: pct(newUsers, prevUsers) },
          messages:     { value: newMsgs,  growth: pct(newMsgs,  prevMsgs)  },
          reservations: { value: newRes,   growth: pct(newRes,   prevRes)   },
        },
        chart,
        conversion: {
          pct: conversionPct,
          total: newRes,
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
