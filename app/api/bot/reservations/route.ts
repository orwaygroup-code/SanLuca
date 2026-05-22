import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const BOT_KEY = process.env.BOT_API_KEY;

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  
  const tokensA = na.split(/\s+/).filter(t => t.length > 2);
  const tokensB = nb.split(/\s+/).filter(t => t.length > 2);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  
  let matches = 0;
  for (const ta of tokensA) {
    for (const tb of tokensB) {
      if (ta === tb) { matches += 1; break; }
      if (ta.includes(tb) || tb.includes(ta)) { matches += 0.7; break; }
      const longer = ta.length > tb.length ? ta : tb;
      const shorter = ta.length > tb.length ? tb : ta;
      if (longer.length - shorter.length <= 2) {
        let same = 0;
        for (let i = 0; i < shorter.length; i++) {
          if (longer.includes(shorter[i])) same++;
        }
        if (same / shorter.length >= 0.7) { matches += 0.5; break; }
      }
    }
  }
  
  return matches / Math.max(tokensA.length, tokensB.length);
}

function parseFecha(s: string): Date | null {
  const parts = s.split('/').map(Number);
  if (parts.length !== 3) return null;
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

export async function GET(request: NextRequest) {
  try {
    const botKey = request.headers.get('x-bot-key');
    if (botKey !== BOT_KEY) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const zona = searchParams.get('zona');
    const buscar = searchParams.get('buscar');
    const telefono = searchParams.get('telefono');
    const soloActivas = searchParams.get('solo_activas') === 'true';
    const soloPasadas = searchParams.get('solo_pasadas') === 'true';

    const where: any = {
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    };

    // Single date filter
    if (fecha && !desde && !hasta) {
      const parsed = parseFecha(fecha);
      if (parsed) {
        const dayStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0);
        const dayEnd = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59);
        where.date = { gte: dayStart, lte: dayEnd };
      }
    }

    // Date range filter
    if (desde && hasta) {
      const desdeParsed = parseFecha(desde);
      const hastaParsed = parseFecha(hasta);
      if (desdeParsed && hastaParsed) {
        const start = new Date(desdeParsed.getFullYear(), desdeParsed.getMonth(), desdeParsed.getDate(), 0, 0, 0);
        const end = new Date(hastaParsed.getFullYear(), hastaParsed.getMonth(), hastaParsed.getDate(), 23, 59, 59);
        where.date = { gte: start, lte: end };
      }
    }

    // Only future/active reservations
    if (soloActivas && !fecha && !desde) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.date = { gte: today };
    }

    // Only past reservations
    if (soloPasadas && !fecha && !desde) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.date = { lt: today };
    }

    if (zona) {
      where.sectionPreference = { equals: zona, mode: 'insensitive' };
    }

    if (telefono) {
      where.guestPhone = { contains: telefono };
    }

    let reservations = await prisma.reservation.findMany({
      where,
      orderBy: { date: 'asc' },
      select: {
        id: true,
        guestName: true,
        guestPhone: true,
        date: true,
        guests: true,
        sectionPreference: true,
        status: true,
        notes: true,
        table: {
          select: {
            number: true,
            section: { select: { name: true } },
          },
        },
      },
    });

    // Fuzzy name search
    if (buscar && buscar.trim().length > 0) {
      const scored = reservations
        .map(r => ({ ...r, _score: similarity(r.guestName || '', buscar) }))
        .filter(r => r._score >= 0.3)
        .sort((a, b) => b._score - a._score);
      reservations = scored.map(({ _score, ...rest }) => rest);
    }

    return NextResponse.json({
      success: true,
      total: reservations.length,
      data: reservations,
      filtros_aplicados: {
        fecha: fecha || null,
        desde: desde || null,
        hasta: hasta || null,
        zona: zona || null,
        buscar: buscar || null,
        telefono: telefono || null,
        solo_activas: soloActivas,
        solo_pasadas: soloPasadas,
      },
    });
  } catch (error) {
    console.error('[API] GET /api/bot/reservations error:', error);
    return NextResponse.json({ success: false, error: 'Error al consultar reservas' }, { status: 500 });
  }
}
