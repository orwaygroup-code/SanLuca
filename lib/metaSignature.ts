import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifica la firma X-Hub-Signature-256 de Meta sobre el cuerpo CRUDO del webhook.
 * Falla cerrado: sin `WHATSAPP_APP_SECRET`, sin header, o con prefijo distinto de
 * "sha256=", devuelve false.
 */
export function verifyMetaSignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(header.slice(7), "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
