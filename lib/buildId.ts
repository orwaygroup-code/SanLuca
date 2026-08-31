import { readFileSync } from "fs";
import { join } from "path";

/**
 * Identificador del build en servicio. Se lee UNA vez al arrancar el proceso —
 * no cambia durante su vida— y lo usan dos consumidores:
 *
 *   - /api/version, que responde qué está desplegado AHORA.
 *   - El HTML que renderiza el servidor, que queda sellado con el build que lo
 *     produjo.
 *
 * Comparar ambos es lo que delata a un dispositivo que está corriendo código
 * viejo: si el navegador sirve el HTML de su caché, ese HTML trae el sello
 * anterior mientras la API responde el nuevo, y el aviso de actualizar aparece
 * ya en la primera consulta. Antes se comparaba la API contra sí misma, así que
 * solo se detectaba un deploy ocurrido con la app abierta.
 */
let BUILD = "dev";
try {
  BUILD = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || BUILD;
} catch {
  /* en desarrollo el archivo no existe: queda "dev" */
}

export const BUILD_ID = BUILD;
