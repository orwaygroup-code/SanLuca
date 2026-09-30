/**
 * Marca del restaurante (solo el NOMBRE, lado servidor). Ola T-2.
 *
 * Sale del `.env`, no de la base: es un valor que cambia una vez en la vida de la instancia,
 * no justifica una consulta, y lo consumen objetos `metadata` estáticos (páginas de menú) que
 * no pueden esperar a un `await`.
 *
 * SIN prefijo `NEXT_PUBLIC_` a propósito: esas variables se hornean en el bundle al compilar,
 * lo que obligaría a una imagen por cliente. Leída en el servidor, la MISMA imagen sirve para
 * todas las instancias (una imagen, N restaurantes). Si algún valor de marca hiciera falta en
 * el navegador, se pasa desde un componente de servidor, no con `NEXT_PUBLIC_`.
 *
 * Ningún valor por defecto dice «San Luca»: una instancia mal configurada debe verse mal
 * («Restaurante»), no disfrazarse de otro cliente.
 */

export interface Brand { name: string; shortName: string }

export function resolveBrand(env: NodeJS.ProcessEnv): Brand {
  const name = typeof env.RESTAURANT_NAME === "string" ? env.RESTAURANT_NAME.trim() : "";
  // Sin RESTAURANT_NAME la instancia está mal configurada: ambos caen a "Restaurante".
  if (!name) return { name: "Restaurante", shortName: "Restaurante" };
  const short = typeof env.RESTAURANT_SHORT_NAME === "string" ? env.RESTAURANT_SHORT_NAME.trim() : "";
  return { name, shortName: short || name };
}

// Aviso una sola vez al cargar el módulo, solo en producción y solo si falta la variable.
// Un warn, no un throw: una marca mal puesta es un bochorno, no un agujero de seguridad.
if (process.env.NODE_ENV === "production" && !process.env.RESTAURANT_NAME) {
  console.warn("[brand] RESTAURANT_NAME no está definido: la marca sale como \"Restaurante\".");
}

export const BRAND: Brand = resolveBrand(process.env);
