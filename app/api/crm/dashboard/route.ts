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

// México: UTC-6 todo el año (sin DST desde 2022).
// El servidor corre en UTC, por eso aplicamos el offset manualmente al
// derivar año/mes/día/DOW de un timestamp.
const MX_OFFSET_MS = 6 * 3600 * 1000;
function mxParts(d: Date) {
  const s = new Date(d.getTime() - MX_OFFSET_MS);
  return { y: s.getUTCFullYear(), m: s.getUTCMonth(), day: s.getUTCDate(), dow: s.getUTCDay() };
}
function mxMidnight(y: number, m: number, day: number): Date {
  // Medianoche de México (00:00 MX = 06:00 UTC) representado como Date UTC.
  return new Date(Date.UTC(y, m, day, 6, 0, 0, 0));
}

function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

type Period = "month" | "year" | "week";

function isoWeekStartMx(year: number, week: number): Date {
  // ISO 8601: la semana 1 contiene el 4 de enero.
  // En MX, calculamos el lunes de la semana 1, luego sumamos (week-1)*7 días.
  const jan4Dow = mxParts(mxMidnight(year, 0, 4)).dow || 7; // dom→7, lun→1...
  const week1MonDay = 4 - jan4Dow + 1; // día del mes (puede ser negativo, p.ej. -2 = 29 de diciembre del año anterior)
  return new Date(mxMidnight(year, 0, week1MonDay).getTime() + (week - 1) * 7 * 86400000);
}

function parseRange(period: Period, value: string | null): {
  start: Date;
  end:   Date;
  prevStart: Date;
  prevEnd:   Date;
} {
  const nowMx = mxParts(new Date());
  if (period === "year") {
    const y = value ? parseInt(value, 10) : nowMx.y;
    return {
      start:     mxMidnight(y,     0, 1),
      end:       mxMidnight(y + 1, 0, 1),
      prevStart: mxMidnight(y - 1, 0, 1),
      prevEnd:   mxMidnight(y,     0, 1),
    };
  }
  if (period === "week") {
    let y = nowMx.y, w = 1;
    if (value) {
      const m = value.match(/^(\d{4})-W(\d{1,2})$/);
      if (m) { y = parseInt(m[1], 10); w = parseInt(m[2], 10); }
    } else {
      // ISO week actual en hora MX
      const todayMxMid = mxMidnight(nowMx.y, nowMx.m, nowMx.day);
      const todayDow = mxParts(todayMxMid).dow || 7;
      const thursday = new Date(todayMxMid.getTime() + (4 - todayDow) * 86400000);
      const thuMx = mxParts(thursday);
      y = thuMx.y;
      const week1Mon = isoWeekStartMx(y, 1);
      w = Math.floor((thursday.getTime() - week1Mon.getTime()) / (7 * 86400000)) + 1;
    }
    const start = isoWeekStartMx(y, w);
    const end       = new Date(start.getTime() + 7 * 86400000);
    const prevStart = new Date(start.getTime() - 7 * 86400000);
    return { start, end, prevStart, prevEnd: start };
  }
  // month
  let y = nowMx.y, m = nowMx.m;
  if (value) {
    const [yy, mm] = value.split("-").map((x) => parseInt(x, 10));
    if (!isNaN(yy) && !isNaN(mm)) { y = yy; m = mm - 1; }
  }
  return {
    start:     mxMidnight(y, m,     1),
    end:       mxMidnight(y, m + 1, 1),
    prevStart: mxMidnight(y, m - 1, 1),
    prevEnd:   mxMidnight(y, m,     1),
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
      // Reservas: por `date` (fecha de visita) → métrica de afluencia.
      // Usuarios y mensajes: por `createdAt` (cuándo aparecieron).
      // Conversaciones WA: por `createdAt` (cuándo iniciaron).
      const resWhere = (gte: Date, lt: Date) => ({
        date: { gte, lt },
        ...(sourceFilter ? { source: sourceFilter as "WHATSAPP" | "WEB" } : {}),
      });

      const [newUsersRows, prevUsersRows, newResRows, prevResRows, newMsgsRows, prevMsgsRows] = await Promise.all([
        db.user.findMany({ where: { createdAt: { gte: start,     lt: end     } }, select: { createdAt: true } }),
        db.user.findMany({ where: { createdAt: { gte: prevStart, lt: prevEnd } }, select: { createdAt: true } }),
        db.reservation.findMany({ where: resWhere(start,     end),     select: { date: true, status: true, source: true } }),
        db.reservation.findMany({ where: resWhere(prevStart, prevEnd), select: { date: true } }),
        db.whatsAppMessage.findMany({ where: { createdAt: { gte: start,     lt: end     }, direction: "INBOUND" }, select: { createdAt: true } }),
        db.whatsAppMessage.findMany({ where: { createdAt: { gte: prevStart, lt: prevEnd }, direction: "INBOUND" }, select: { createdAt: true } }),
      ]);

      // DOW se evalúa en hora México (el servidor está en UTC).
      const dowOk = (d: Date) => allowedDays.includes(mxParts(d).dow);

      const newUsers = newUsersRows.filter((r) => dowOk(r.createdAt)).length;
      const prevUsers = prevUsersRows.filter((r) => dowOk(r.createdAt)).length;
      const newResFiltered = newResRows.filter((r) => dowOk(r.date));
      const prevRes = prevResRows.filter((r) => dowOk(r.date)).length;
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
      const nowMx = mxParts(new Date());
      const todayStartMx = mxMidnight(nowMx.y, nowMx.m, nowMx.day);
      let chart: { label: string; value: number }[] = [];

      // Regla común: los días/meses futuros se omiten SOLO si están vacíos.
      // Si ya hay reservas futuras agendadas, esos días/meses sí se muestran.
      // Todas las comparaciones de fecha se hacen en hora México.
      if (period === "year") {
        const y = mxParts(start).y;
        const buckets = Array.from({ length: 12 }, (_, m) => {
          const monthStartMx = mxMidnight(y, m, 1);
          return { label: MONTH_LABELS[m], isFuture: monthStartMx.getTime() > todayStartMx.getTime(), count: 0 };
        });
        for (const r of newResFiltered) {
          const p = mxParts(r.date);
          if (p.y === y) buckets[p.m].count += 1;
        }
        chart = buckets
          .filter((b) => !b.isFuture || b.count > 0)
          .map((b) => ({ label: b.label, value: b.count }));
      } else if (period === "week") {
        const buckets: { label: string; dayKey: number; isFuture: boolean; count: number }[] = [];
        const startMx = mxParts(start);
        for (let i = 0; i < 7; i++) {
          const dayMid = mxMidnight(startMx.y, startMx.m, startMx.day + i);
          if (!dowOk(dayMid)) continue;
          buckets.push({
            label: DAY_LABELS[mxParts(dayMid).dow],
            dayKey: dayMid.getTime(),
            isFuture: dayMid.getTime() > todayStartMx.getTime(),
            count: 0,
          });
        }
        for (const r of newResFiltered) {
          const p = mxParts(r.date);
          const key = mxMidnight(p.y, p.m, p.day).getTime();
          const idx = buckets.findIndex((b) => b.dayKey === key);
          if (idx >= 0) buckets[idx].count += 1;
        }
        chart = buckets
          .filter((b) => !b.isFuture || b.count > 0)
          .map((b) => ({ label: b.label, value: b.count }));
      } else {
        // month → un bar por día (omitiendo días no permitidos)
        const startMx = mxParts(start);
        const y = startMx.y, m = startMx.m;
        const daysInMonth = mxParts(new Date(mxMidnight(y, m + 1, 1).getTime() - 86400000)).day;
        const buckets: { label: string; dayKey: number; isFuture: boolean; count: number }[] = [];
        for (let day = 1; day <= daysInMonth; day++) {
          const dayMid = mxMidnight(y, m, day);
          if (!dowOk(dayMid)) continue;
          buckets.push({
            label: String(day),
            dayKey: dayMid.getTime(),
            isFuture: dayMid.getTime() > todayStartMx.getTime(),
            count: 0,
          });
        }
        for (const r of newResFiltered) {
          const p = mxParts(r.date);
          if (p.y !== y || p.m !== m) continue;
          const key = mxMidnight(p.y, p.m, p.day).getTime();
          const idx = buckets.findIndex((b) => b.dayKey === key);
          if (idx >= 0) buckets[idx].count += 1;
        }
        chart = buckets
          .filter((b) => !b.isFuture || b.count > 0)
          .map((b) => ({ label: b.label, value: b.count }));
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
