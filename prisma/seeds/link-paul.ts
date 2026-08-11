import { randomBytes } from "crypto";
import { prisma } from "../../lib/prisma";
import { resolvePin } from "../../lib/staff";
import { isValidPin } from "../../lib/staff-auth";
import { hashPassword } from "../../lib/auth";

/**
 * Crea (o reutiliza) al dueño-admin "Paul":
 *   1) Staff MANAGER "paul" con PIN (SEED_PAUL_PIN, 4 dígitos).
 *   2) User ADMIN ligado (User.staffId) → el puente de identidad del login de staff
 *      emite TAMBIÉN la sesión sl_session, así el MISMO PIN abre /admin y /crm.
 *
 * Idempotente: si "paul" ya existe no le toca el PIN; si el User ya existe solo
 * asegura role=ADMIN + el vínculo. El PIN NO se hardcodea (se pasa por env).
 *
 * Correr en el VPS:
 *   cd /var/www/sanluca
 *   SEED_PAUL_PIN=1430 npx tsx prisma/seeds/link-paul.ts
 */

const TENANT = 1;
const USERNAME = "paul";
const FULLNAME = "Paul";
const EMAIL = process.env.PAUL_EMAIL || "paul@sanlucaristorante.com";
const PIN = process.env.SEED_PAUL_PIN;

async function main() {
  // 1) Staff MANAGER "paul".
  let staff = await prisma.staff.findUnique({ where: { username: USERNAME }, select: { id: true, role: true } });
  if (!staff) {
    if (!PIN || !isValidPin(PIN)) {
      console.error("✗ Falta SEED_PAUL_PIN de 4 dígitos.\n  Corre:  SEED_PAUL_PIN=1430 npx tsx prisma/seeds/link-paul.ts");
      process.exit(1);
    }
    const { hash } = await resolvePin(PIN, { tenantId: TENANT }); // lanza si el PIN ya está en uso por otro empleado
    staff = await prisma.staff.create({
      data: { tenantId: TENANT, username: USERNAME, fullName: FULLNAME, role: "MANAGER", pinHash: hash },
      select: { id: true, role: true },
    });
    console.log(`✅ Staff creado: "${USERNAME}" (MANAGER, #${staff.id}) con el PIN indicado.`);
  } else if (staff.role !== "MANAGER") {
    await prisma.staff.update({ where: { id: staff.id }, data: { role: "MANAGER" } });
    console.log(`↻ Staff "${USERNAME}" ya existía → rol ajustado a MANAGER (#${staff.id}). PIN sin cambios.`);
  } else {
    console.log(`↩ Staff "${USERNAME}" ya existía (MANAGER, #${staff.id}). PIN sin cambios.`);
  }

  // 2) User ADMIN ligado (puente /admin + /crm con el mismo PIN).
  const existingUser = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, staffId: true, role: true } });
  if (existingUser) {
    if (existingUser.staffId !== staff.id || existingUser.role !== "ADMIN") {
      await prisma.user.update({ where: { id: existingUser.id }, data: { staffId: staff.id, role: "ADMIN" } });
      console.log(`✅ User ${EMAIL} → ADMIN + ligado a Staff "${USERNAME}" (#${staff.id}).`);
    } else {
      console.log(`↩ User ${EMAIL} ya era ADMIN y estaba ligado a "${USERNAME}".`);
    }
  } else {
    const tempPassword = randomBytes(12).toString("base64url");
    await prisma.user.create({
      data: {
        name: FULLNAME,
        email: EMAIL,
        role: "ADMIN",
        passwordHash: await hashPassword(tempPassword),
        staffId: staff.id,
        acceptedTermsAt: new Date(),
      },
    });
    console.log(`✅ User ADMIN creado y ligado a Staff "${USERNAME}" (#${staff.id}).`);
    console.log(`   email:    ${EMAIL}`);
    console.log(`   password: ${tempPassword}   ← respaldo para login por email; con el PIN NO lo necesitas.`);
  }

  console.log(`\n➡  Entra en /staff/login con usuario "${USERNAME}" y tu PIN.`);
  console.log(`   Un solo PIN abre: operación, caja, comandero, supervisor Y /admin + /crm.`);
}

main()
  .catch((e) => { console.error("Error en link-paul:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
