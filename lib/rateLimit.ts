// Límite de intentos en memoria. El modelo de despliegue es UNA instancia por
// restaurante con un solo proceso PM2, así que un Map en memoria basta. Si algún
// día se corre en cluster, migrar a Redis o a una tabla.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Devuelve true si la acción se permite; false si el bucket está agotado. */
export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

export function reset(key: string): void { buckets.delete(key); }
