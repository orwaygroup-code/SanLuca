"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStaffSession } from "@/lib/staff-session-client";

// Solo estos roles reciben/ven notificaciones (managers todo; operación las reservas).
const NOTIFY_ROLES = ["MANAGER", "OPERATION", "CAPTAIN"];
const SEEN_KEY = "sl_notif_seen_at";

interface Notif { id: number; type: string; title: string; body: string; url: string | null; createdAt: string }

const C = { bg: "#16201f", panel: "#1a2628", gold: "#ba843c", cream: "#f5f1e8", dim: "rgba(245,241,232,0.62)", faint: "rgba(245,241,232,0.42)", border: "rgba(186,132,60,0.3)", line: "rgba(255,255,255,0.08)", red: "#e0574f" };

function urlB64ToUint8Array(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function StaffNotifications() {
  const { staff, loading } = useStaffSession();
  const enabled = !!staff && NOTIFY_ROLES.includes(staff.role);

  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [lastSeen, setLastSeen] = useState<number>(0);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    try { setLastSeen(Number(localStorage.getItem(SEEN_KEY)) || 0); } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/staff/notifications", { credentials: "same-origin" });
      const d = await r.json().catch(() => null);
      if (d?.success) setItems(d.data as Notif[]);
    } catch { /* ignore */ }
  }, []);

  // Suscribe este dispositivo a Web Push (una vez, si hay permiso concedido).
  const subscribe = useCallback(async () => {
    if (subscribedRef.current) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const vr = await fetch("/api/staff/push/vapid").then((r) => r.json()).catch(() => null);
      const key = vr?.data?.publicKey;
      if (!key) return;
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) as BufferSource });
      await fetch("/api/staff/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(sub.toJSON()) });
      subscribedRef.current = true;
    } catch (e) { console.error("[push] no se pudo suscribir:", e); }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [enabled, load]);

  useEffect(() => {
    if (enabled && perm === "granted") subscribe();
  }, [enabled, perm, subscribe]);

  const askPermission = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") subscribe();
  };

  const openPanel = () => {
    setOpen((v) => !v);
    if (!open) {
      const now = Date.now();
      setLastSeen(now);
      try { localStorage.setItem(SEEN_KEY, String(now)); } catch { /* ignore */ }
    }
  };

  if (loading || !enabled) return null;

  const unread = items.filter((n) => new Date(n.createdAt).getTime() > lastSeen).length;
  const fmt = (iso: string) => new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 2147483000 }}>
      {open && (
        <div style={{ position: "absolute", right: 0, bottom: 58, width: "min(92vw, 360px)", maxHeight: "70vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.cream, fontWeight: 800, fontSize: "0.9rem" }}>Notificaciones</span>
            {perm !== "granted" && perm !== "unsupported" && (
              <button onClick={askPermission} style={{ background: C.gold, color: "#16201f", border: "none", borderRadius: 8, padding: "5px 10px", fontWeight: 800, fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit" }}>Activar en este equipo</button>
            )}
          </div>
          {perm === "denied" && (
            <div style={{ padding: "10px 14px", color: C.faint, fontSize: "0.74rem", borderBottom: `1px solid ${C.line}` }}>Las notificaciones están bloqueadas en este equipo. Actívalas en los ajustes del navegador para recibir avisos con la app cerrada.</div>
          )}
          {items.length === 0 ? (
            <div style={{ padding: 24, color: C.faint, fontSize: "0.84rem", textAlign: "center" }}>Sin notificaciones.</div>
          ) : (
            items.map((n) => {
              const isNew = new Date(n.createdAt).getTime() > lastSeen;
              return (
                <button key={n.id} onClick={() => { if (n.url) window.location.href = n.url; }} style={{ display: "block", width: "100%", textAlign: "left", background: isNew ? "rgba(186,132,60,0.08)" : "transparent", border: "none", borderBottom: `1px solid ${C.line}`, padding: "11px 14px", cursor: n.url ? "pointer" : "default", fontFamily: "inherit" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isNew && <span style={{ width: 7, height: 7, borderRadius: 999, background: C.gold, flexShrink: 0 }} />}
                    <span style={{ color: C.cream, fontWeight: 700, fontSize: "0.84rem", flex: 1, minWidth: 0 }}>{n.title}</span>
                    <span style={{ color: C.faint, fontSize: "0.66rem", whiteSpace: "nowrap" }}>{fmt(n.createdAt)}</span>
                  </div>
                  <div style={{ color: C.dim, fontSize: "0.78rem", marginTop: 3 }}>{n.body}</div>
                </button>
              );
            })
          )}
        </div>
      )}

      <button onClick={openPanel} aria-label="Notificaciones" style={{ position: "relative", width: 50, height: 50, borderRadius: 999, background: C.panel, border: `1px solid ${C.border}`, color: C.gold, cursor: "pointer", boxShadow: "0 6px 22px rgba(0,0,0,0.45)", display: "grid", placeItems: "center" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{ position: "absolute", top: -3, right: -3, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999, background: C.red, color: "#fff", fontSize: "0.7rem", fontWeight: 800, display: "grid", placeItems: "center", boxSizing: "border-box" }}>{unread > 99 ? "99+" : unread}</span>
        )}
      </button>
    </div>
  );
}
