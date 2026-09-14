import { createHmac, randomBytes } from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "sanluca-dev-secret";

export interface GoogleTokenPayload {
  userId: string;
  userName: string;
  userRole: string;
  nonce: string;
  exp: number;
}

export function signGoogleToken(userId: string, userName: string, userRole: string): string {
  const payload = JSON.stringify({
    userId,
    userName,
    userRole,
    exp: Date.now() + 120_000, // 2 minutos
    nonce: randomBytes(8).toString("hex"),
  });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyGoogleToken(token: string): GoogleTokenPayload | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const encoded = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expectedSig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return {
      userId: payload.userId,
      userName: payload.userName,
      userRole: payload.userRole ?? "CUSTOMER",
      nonce: payload.nonce,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

// Canje de UN SOLO USO. Un token válido solo se consume una vez: su `nonce` (8
// bytes que mete signGoogleToken) queda registrado en memoria hasta que expira, y
// un segundo canje del mismo token se rechaza. Poda los vencidos en cada llamada.
// PM2 corre una sola instancia en `fork`, así que el Map en memoria basta; si
// algún día pasa a `cluster`, mover a base.
const consumedNonces = new Map<string, number>(); // nonce -> exp (ms)

export function consumeGoogleToken(token: string): GoogleTokenPayload | null {
  const payload = verifyGoogleToken(token);
  if (!payload) return null;
  const now = Date.now();
  for (const [nonce, exp] of consumedNonces) {
    if (exp < now) consumedNonces.delete(nonce);
  }
  if (consumedNonces.has(payload.nonce)) return null; // ya canjeado antes
  consumedNonces.set(payload.nonce, payload.exp);
  return payload;
}
