import { randomBytes } from "crypto";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../lib/auth";

/**
 * Vincula el User ADMIN de Ricardo (sl_session) con su Staff "ricardo" (sl_staff)
 * vía User.staffId. Idempotente (Fase B.2).
 *
 * Reglas:
 *  - Busca el User por email (RICARDO_EMAIL, default admin@sanlucaristorante.com).
 *  - Si lo encuentra → setea User.staffId = Staff("ricardo").id. (PROD: este es el path.)
 *  - Si NO lo encuentra:
 *      · Solo si ALLOW_CREATE_PLACEHOLDER=true (LOCAL dev, DB sin Users) crea un
 *        User ADMIN con password aleatorio FUERTE (impreso una vez) y lo vincula.
 *      · En cualquier otro caso (prod) → PARA y avisa. NO crea placeholder silencioso.
 *
 * Correr:  npm run db:seed:link-ricardo
 *   local: ALLOW_CREATE_PLACEHOLDER=true npm run db:seed:link-ricardo
 */

const EMAIL = process.env.RICARDO_EMAIL || "admin@sanlucaristorante.com";
const ALLOW_PLACEHOLDER = process.env.ALLOW_CREATE_PLACEHOLDER === "true";

async function main() {
  const staff = await prisma.staff.findUnique({ where: { username: "ricardo" }, select: { id: true } });
  if (!staff) {
    console.error('✗ No existe el Staff "ricardo". Corre primero: npm run db:seed:staff');
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, staffId: true } });

  if (existingUser) {
    if (existingUser.staffId === staff.id) {
      console.log(`↩ Ya estaba vinculado: User ${EMAIL} ↔ Staff "ricardo" (#${staff.id}).`);
      return;
    }
    await prisma.user.update({ where: { id: existingUser.id }, data: { staffId: staff.id } });
    console.log(`✅ Vinculado: User ${EMAIL} ↔ Staff "ricardo" (#${staff.id}).`);
    return;
  }

  // No existe el User con ese email.
  if (!ALLOW_PLACEHOLDER) {
    console.error(
      `✗ No se encontró el User ${EMAIL}.\n` +
      `  EN PROD: verifica el email del admin del panel legacy (RICARDO_EMAIL) y reintenta.\n` +
      `  EN LOCAL (DB sin Users): corre con ALLOW_CREATE_PLACEHOLDER=true para crear un admin de dev.`,
    );
    process.exit(1);
  }

  // Path SOLO local: crear admin placeholder con password aleatorio fuerte.
  const tempPassword = randomBytes(12).toString("base64url");
  const created = await prisma.user.create({
    data: {
      name: "Ricardo Camacho",
      email: EMAIL,
      role: "ADMIN",
      passwordHash: await hashPassword(tempPassword),
      staffId: staff.id,
      acceptedTermsAt: new Date(),
    },
    select: { id: true },
  });
  console.log(`✅ [LOCAL] User ADMIN placeholder creado y vinculado a Staff "ricardo" (#${staff.id}).`);
  console.log(`   email:    ${EMAIL}`);
  console.log(`   password: ${tempPassword}   ← solo dev, cámbialo. No se vuelve a mostrar.`);
}

main()
  .catch((e) => { console.error("Error en link-ricardo:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
