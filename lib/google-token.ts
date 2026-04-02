import { createHmac, randomBytes } from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "sanluca-dev-secret";

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

export function verifyGoogleToken(token: string): { userId: string; userName: string; userRole: string } | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const encoded = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expectedSig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return { userId: payload.userId, userName: payload.userName, userRole: payload.userRole ?? "CUSTOMER" };
  } catch {
    return null;
  }
}
