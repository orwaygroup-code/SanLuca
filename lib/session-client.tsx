"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "HOSTES" | "ADMIN";
}

interface SessionState {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout:  () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

/**
 * Hidrata desde /api/auth/me (cookie httpOnly) y expone helpers.
 *
 * IMPORTANTE: el state inicial DEBE ser null para que el HTML del servidor
 * coincida con el primer render del cliente (evita hydration mismatch
 * React #418). Después del mount, useEffect hidrata desde localStorage
 * (cache rápido) y verifica con /api/auth/me.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (!r.ok) {
        setUser(null);
        try { localStorage.removeItem("userId"); localStorage.removeItem("userName"); localStorage.removeItem("userRole"); } catch {}
        return;
      }
      const data = await r.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
        try {
          localStorage.setItem("userId",   data.user.id);
          localStorage.setItem("userName", data.user.name);
          localStorage.setItem("userRole", data.user.role);
        } catch {}
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setUser(null);
    try { localStorage.removeItem("userId"); localStorage.removeItem("userName"); localStorage.removeItem("userRole"); } catch {}
  }, []);

  useEffect(() => {
    // 1) Hidratar cache rápido de localStorage DESPUÉS de mount (no afecta hidratación)
    try {
      const id   = localStorage.getItem("userId");
      const name = localStorage.getItem("userName");
      const role = localStorage.getItem("userRole") as SessionUser["role"] | null;
      if (id && name && role) setUser({ id, name, email: "", role });
    } catch {}
    // 2) Verificar con servidor (fuente de verdad)
    refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ user, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(Ctx);
  if (!ctx) return { user: null, loading: false, refresh: async () => {}, logout: async () => {} };
  return ctx;
}
