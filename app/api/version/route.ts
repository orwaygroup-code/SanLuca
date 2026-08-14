import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * GET /api/version — devuelve el BUILD_ID de Next (cambia en CADA build/deploy). El
 * cliente lo compara contra el que tenía al cargar; si cambió, ofrece "Actualizar".
 * Se lee UNA vez al arrancar el proceso (no cambia durante la vida del proceso).
 */
let BUILD = "dev";
try {
  BUILD = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || BUILD;
} catch {
  /* en dev o si no existe el archivo, queda "dev" */
}

export async function GET() {
  return NextResponse.json({ build: BUILD }, { headers: { "Cache-Control": "no-store" } });
}
