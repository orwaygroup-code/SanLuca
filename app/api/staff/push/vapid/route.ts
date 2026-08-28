import { NextResponse } from "next/server";

/** GET /api/staff/push/vapid — llave pública VAPID para suscribirse a Web Push (no es secreta). */
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? null;
  return NextResponse.json({ success: true, data: { publicKey } });
}
