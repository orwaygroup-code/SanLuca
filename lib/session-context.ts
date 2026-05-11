import { AsyncLocalStorage } from "async_hooks";
import type { ServerSession } from "./auth-server";

/**
 * AsyncLocalStorage que propaga la sesión del request por toda la cadena
 * asíncrona sin tocar firmas de funciones. `prismaApp.withApp()` la lee
 * para inyectar `SET LOCAL app.user_id` y `SET LOCAL app.role` antes de
 * cada query, lo que activa las policies de RLS.
 */
const storage = new AsyncLocalStorage<ServerSession | null>();

export function runWithSession<T>(
  s: ServerSession | null,
  fn: () => T | Promise<T>
): Promise<T> {
  return Promise.resolve(storage.run(s, fn));
}

export function getCurrentSession(): ServerSession | null {
  return storage.getStore() ?? null;
}
