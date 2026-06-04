"use client";

import { useEffect, useState, useCallback } from "react";

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
 * Hook autocontenido (sin provider) para la sesión de Staff.
 * Hidrata desde /api/auth/staff/me (cookie httpOnly `sl_staff`).
 * Realm separado del `useSession()` de comensales/admin web.
 */
export function useStaffSession(): StaffSessionState {
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/auth/staff/me", { credentials: "same-origin" });
      const data = await r.json().catch(() => null);
      setStaff(data?.success ? (data.data as StaffUser | null) : null);
    } catch {
      setStaff(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/staff/logout", { method: "POST", credentials: "same-origin" });
    setStaff(null);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { staff, loading, refresh, logout };
}
