"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";

export interface StaffUser {
  id:       number;
  username: string;
  fullName: string;
  role:     "WAITER" | "OPERATION" | "CAPTAIN" | "MANAGER";
}

interface StaffSessionState {
  staff:   StaffUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout:  () => Promise<void>;
}

/**
 * Sesión de Staff (cookie httpOnly `sl_staff`), con caché compartida entre
 * todos los componentes que la consumen. Realm separado del `useSession()` de
 * comensales/admin web.
 *
 * Antes cada componente que llamaba al hook arrancaba en `loading: true` y
 * disparaba SU PROPIO fetch a /api/auth/staff/me. Como lo usan trece
 * componentes, cada navegación repintaba el estado de carga y esperaba otro
 * viaje de red antes de decidir si redirigir: por eso al pasar de una vista a
 * otra se alcanzaban a ver los pasos intermedios (login → piso → destino).
 *
 * Ahora la sesión vive en un store de módulo:
 *  - La primera resolución se guarda; los montajes siguientes arrancan con el
 *    valor conocido y `loading: false`, así que no hay parpadeo de carga.
 *  - Las peticiones concurrentes comparten la misma promesa, de modo que trece
 *    componentes montándose a la vez hacen UNA sola llamada.
 *  - Al volver a montar se revalida en segundo plano, sin volver a "cargando":
 *    si la cookie caducó, el guardia redirige igual, sólo que sin el destello.
 */

type Snapshot = { staff: StaffUser | null; loading: boolean };

// `loading: true` sólo hasta la primera resolución del proceso.
let snapshot: Snapshot = { staff: null, loading: true };
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setSnapshot(next: Snapshot) {
  // Misma identidad si nada cambió: evita re-render innecesario en los 13
  // consumidores cada vez que se revalida.
  if (snapshot.staff === next.staff && snapshot.loading === next.loading) return;
  snapshot = next;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

/** En servidor no hay sesión que hidratar; se entrega el estado de carga. */
const SERVER_SNAPSHOT: Snapshot = { staff: null, loading: true };
function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

async function fetchSession(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const r = await fetch("/api/auth/staff/me", { credentials: "same-origin" });
      const data = await r.json().catch(() => null);
      const next = data?.success ? (data.data as StaffUser | null) : null;
      // Identidad estable cuando es el mismo usuario: sin esto, cada
      // revalidación entregaría un objeto nuevo y volvería a renderizar todo.
      const same = next && snapshot.staff && next.id === snapshot.staff.id && next.role === snapshot.staff.role;
      setSnapshot({ staff: same ? snapshot.staff : next, loading: false });
    } catch {
      setSnapshot({ staff: null, loading: false });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function useStaffSession(): StaffSessionState {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Sólo para forzar el re-render tras un logout local (el store ya notifica).
  const [, bump] = useState(0);

  useEffect(() => {
    // Revalida al montar. Si ya hay valor cacheado no se muestra "cargando":
    // la pantalla se pinta de inmediato y el dato se refresca por detrás.
    void fetchSession();
  }, []);

  const refresh = useCallback(async () => {
    await fetchSession();
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/staff/logout", { method: "POST", credentials: "same-origin" });
    setSnapshot({ staff: null, loading: false });
    bump((n) => n + 1);
  }, []);

  return { staff: state.staff, loading: state.loading, refresh, logout };
}
