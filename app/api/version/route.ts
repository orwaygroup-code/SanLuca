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

/**
 * Commit desplegado. Lo escribe deploy.sh junto al BUILD_ID.
 *
 * El BUILD_ID cambia en cada build pero no dice QUÉ código corre. Sin este
 * dato, saber si producción tiene lo que está en main exige entrar por SSH —
 * y esa fricción es la razón de que varias veces se diera por perdida una
 * función que en realidad estaba mergeada pero sin desplegar.
 */
let COMMIT = "desconocido";
try {
  COMMIT = readFileSync(join(process.cwd(), ".next", "COMMIT_SHA"), "utf8").trim() || COMMIT;
} catch {
  /* en dev no existe */
}

export async function GET() {
  return NextResponse.json(
    { build: BUILD, commit: COMMIT },
    { headers: { "Cache-Control": "no-store" } }
  );
}
