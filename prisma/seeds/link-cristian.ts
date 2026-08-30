import { randomBytes } from "crypto";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../lib/auth";

/**
 * Da acceso al panel a Cristian Sierra.
 *
 * Su Staff ya existe (username "cris", MANAGER): lo que faltaba era el User
 * ADMIN ligado por User.staffId. Ese vínculo es el "puente de identidad" que
 * usa el login de staff — al validar el PIN, si encuentra un User ADMIN/HOSTES
 * ligado emite TAMBIÉN la cookie sl_session, y con eso el mismo PIN abre /admin
 * y /crm.
 *
 * Sin ese registro, /api/auth/me responde "no admin", el guardia de AdminShell
 * lo rebota al login y termina de vuelta en una vista de staff. Por eso no le
 * aparecía el menú del panel.
 *
 * A diferencia de link-paul, aquí NO se crea ni se toca el Staff: ya está y
 * conserva su PIN. Idempotente: re-ejecutarlo sólo asegura rol y vínculo.
 *
 * Correr en el VPS:
 *   cd /var/www/sanluca && npx tsx prisma/seeds/link-cristian.ts
 */

const USERNAME = "cris";
const FULLNAME = "Cristian Sierra";
const EMAIL = process.env.CRISTIAN_EMAIL || "cristian@sanlucaristorante.com";

async function main() {
  const staff = await prisma.staff.findUnique({
    where: { username: USERNAME },
    select: { id: true, fullName: true, role: true },
  });
  if (!staff) {
    console.error(`✗ No existe el Staff "${USERNAME}". Créalo primero desde /admin/employees.`);
    process.exit(1);
  }
  if (staff.role !== "MANAGER") {
    console.error(`✗ El Staff "${USERNAME}" es ${staff.role}, no MANAGER. El puente admin se reserva a managers.`);
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, staffId: true, role: true },
  });

  if (existing) {
    if (existing.staffId !== staff.id || existing.role !== "ADMIN") {
      await prisma.user.update({ where: { id: existing.id }, data: { staffId: staff.id, role: "ADMIN" } });
      console.log(`✅ User ${EMAIL} → ADMIN + ligado a Staff "${USERNAME}" (#${staff.id}).`);
    } else {
      console.log(`↩ User ${EMAIL} ya era ADMIN y estaba ligado a "${USERNAME}" (#${staff.id}).`);
    }
  } else {
    // Contraseña de respaldo para el login por correo. Con el PIN no hace falta.
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
    console.log(`   password: ${tempPassword}   ← respaldo; con el PIN NO se necesita.`);
  }

  console.log(`\n➡  ${staff.fullName} entra igual que siempre en /staff/login con su PIN.`);
  console.log(`   Ahora ese mismo PIN le abre /admin y /crm, y le aparece el menú del panel.`);
}

main()
  .catch((e) => { console.error("Error en link-cristian:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
