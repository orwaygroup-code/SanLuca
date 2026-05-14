import { NextRequest, NextResponse } from "next/server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { requireAdmin } from "@/lib/auth-server";

// ── Query params ─────────────────────────────────────────────────
//   period  = "month" | "year" | "week"   (default: month)
//   value   = "YYYY-MM" | "YYYY" | "YYYY-Www"  (según period; default: actual)
//   days    = "0,2,3,4,5,6"   (DOW JS/Postgres 0=Dom...6=Sab; default sin lunes)
//   source  = "all" | "WHATSAPP" | "WEB"  (default: all)

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

type Period = "month" | "year" | "week";

function isoWeekStart(year: number, week: number): Date {
  // ISO 8601: la semana 1 es la que contiene el 4 de enero.
  const jan4 = new Date(year, 0, 4);
  const jan4Dow = jan4.getDay() || 7; // dom → 7
  const week1Mon = new Date(year, 0, 4 - jan4Dow + 1);
  const start = new Date(week1Mon);
  start.setDate(week1Mon.getDate() + (week - 1) * 7);
  return start;
}

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
  if (period === "week") {
    let y = now.getFullYear(), w = 1;
    if (value) {
      const m = value.match(/^(\d{4})-W(\d{1,2})$/);
      if (m) { y = parseInt(m[1], 10); w = parseInt(m[2], 10); }
    } else {
      const thu = new Date(now); thu.setDate(now.getDate() + 4 - (now.getDay() || 7));
      y = thu.getFullYear();
      const jan4 = new Date(y, 0, 4);
      const jan4Dow = jan4.getDay() || 7;
      const week1Mon = new Date(y, 0, 4 - jan4Dow + 1);
      w = Math.floor((thu.getTime() - week1Mon.getTime()) / (7 * 86400000)) + 1;
    }
    const start = isoWeekStart(y, w);
    const end   = new Date(start); end.setDate(start.getDate() + 7);
    const prevStart = new Date(start); prevStart.setDate(start.getDate() - 7);
    return { start, end, prevStart, prevEnd: start };
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
      // year  → barras por mes (hasta el mes actual si el año es el actual)
      // month → barras por día del mes (hasta hoy si es el mes actual)
      // week  → barras por día de la semana (hasta hoy si la semana incluye hoy)
      // En todos los casos: se omiten DOWs excluidos por el filtro de días.
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let chart: { label: string; value: number }[] = [];

      if (period === "year") {
        const y = start.getFullYear();
        const lastMonth = y === now.getFullYear() ? now.getMonth() : 11;
        const buckets = Array.from({ length: lastMonth + 1 }, (_, m) => ({ label: MONTH_LABELS[m], count: 0 }));
        for (const r of newResFiltered) {
          if (r.createdAt.getFullYear() === y && r.createdAt.getMonth() <= lastMonth) {
            buckets[r.createdAt.getMonth()].count += 1;
          }
        }
        chart = buckets.map((b) => ({ label: b.label, value: b.count }));
      } else if (period === "week") {
        const buckets: { label: string; dayKey: number; count: number }[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i);
          if (!dowOk(d)) continue;
          if (d.getTime() > todayStart.getTime()) continue; // futuro → fuera
          buckets.push({ label: DAY_LABELS[d.getDay()], dayKey: d.getTime(), count: 0 });
        }
        for (const r of newResFiltered) {
          const d = new Date(r.createdAt.getFullYear(), r.createdAt.getMonth(), r.createdAt.getDate());
          const idx = buckets.findIndex((b) => b.dayKey === d.getTime());
          if (idx >= 0) buckets[idx].count += 1;
        }
        chart = buckets.map((b) => ({ label: b.label, value: b.count }));
      } else {
        // month → un bar por día (omitiendo días no permitidos y futuros)
        const y = start.getFullYear(), m = start.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const buckets: { label: string; dayOfWeek: number; count: number }[] = [];
        for (let day = 1; day <= daysInMonth; day++) {
          const d = new Date(y, m, day);
          if (!dowOk(d)) continue;
          if (d.getTime() > todayStart.getTime()) continue; // futuro → fuera
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
