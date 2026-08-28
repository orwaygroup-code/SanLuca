import webpush from "web-push";
import type { StaffRole } from "@prisma/client";
import { prisma } from "./prisma";

const TENANT = 1;

let vapidReady: boolean | null = null;
function ensureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:orwaygroup@gmail.com";
  vapidReady = !!(pub && priv);
  if (vapidReady) {
    try { webpush.setVapidDetails(subject, pub!, priv!); }
    catch (e) { console.error("[NOTIFY] VAPID inválido:", (e as Error).message); vapidReady = false; }
  }
  return vapidReady;
}

export type NotifyType = "audit" | "turno" | "reserva";
export interface NotifyInput { roles: string[]; type: NotifyType; title: string; body: string; url?: string }

/**
 * Notifica a los roles indicados: guarda la notificación in-app (campana) y la manda por Web
 * Push a cada dispositivo suscrito de esos roles. Fire-and-forget: nunca lanza — cualquier
 * fallo (BD, push, VAPID sin configurar) se loguea y se ignora para no tumbar la operación.
 * Llamar SIN await: `void notify({...})`.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const roles = [...new Set(input.roles.filter(Boolean))];
  if (roles.length === 0) return;
  const title = input.title.slice(0, 120);
  const body = input.body.slice(0, 300);
  const url = input.url ?? null;

  try {
    await prisma.notification.create({ data: { tenantId: TENANT, roles, type: input.type, title, body, url } });
  } catch (e) {
    console.error("[NOTIFY] no se pudo guardar la notificación in-app:", (e as Error).message);
  }

  if (!ensureVapid()) return; // sin llaves → solo in-app
  try {
    const staff = await prisma.staff.findMany({
      where: { tenantId: TENANT, active: true, role: { in: roles as StaffRole[] } },
      select: { id: true },
    });
    const ids = staff.map((s) => s.id);
    if (ids.length === 0) return;
    const subs = await prisma.pushSubscription.findMany({ where: { tenantId: TENANT, staffId: { in: ids } } });
    const payload = JSON.stringify({ title, body, url: url ?? "/" });
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          // Suscripción muerta (dispositivo/permiso revocado): se limpia.
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          console.error("[NOTIFY] push falló:", code, (err as Error)?.message);
        }
      }
    }));
  } catch (e) {
    console.error("[NOTIFY] error enviando Web Push:", (e as Error).message);
  }
}

/** Envía un Web Push a TODOS los dispositivos de UN empleado (notificación personal). */
export async function pushToStaff(employeeId: number, msg: { title: string; body: string; url?: string }): Promise<void> {
  if (!ensureVapid()) return;
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { tenantId: TENANT, staffId: employeeId } });
    if (subs.length === 0) return;
    const payload = JSON.stringify({ title: msg.title.slice(0, 120), body: msg.body.slice(0, 300), url: msg.url ?? "/" });
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
    }));
  } catch (e) {
    console.error("[NOTIFY] pushToStaff falló:", (e as Error).message);
  }
}
