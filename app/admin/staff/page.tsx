"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /admin/staff fue MIGRADO a /admin/employees (Fase B.2: realm sl_session ADMIN).
 * Se deja este redirect para no romper bookmarks.
 */
export default function StaffRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/employees"); }, [router]);
  return null;
}
