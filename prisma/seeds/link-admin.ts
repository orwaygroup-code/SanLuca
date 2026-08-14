import { randomBytes } from "crypto";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../lib/auth";

/**
 * Liga un Staff MANAGER (por username) a un User ADMIN (User.staffId). El puente de
 * identidad del login de staff emite entonces TAMBIÉN la sesión sl_session, así el MISMO
 * PIN abre /admin (dashboard, piso con menú lateral / hamburguesa en móvil) y /crm.
 * Idempotente. Genérico: sirve para cualquier manager.
 *
 * Correr en el VPS:
 *   cd /var/www/sanluca
 *   STAFF_USERNAME=david ADMIN_EMAIL=david@sanlucaristorante.com npx tsx prisma/seeds/link-admin.ts
 * (ADMIN_EMAIL es opcional; por defecto <username>@sanlucaristorante.com. Solo es un
 *  identificador del User: el manager entra por PIN, no por correo.)
 */
const USERNAME = (process.env.STAFF_USERNAME || "").toLowerCase();
const EMAIL = process.env.ADMIN_EMAIL || (USERNAME ? `${USERNAME}@sanlucaristorante.com` : "");

async function main() {
  if (!USERNAME) {
    console.error("✗ Falta STAFF_USERNAME.\n  Ej: STAFF_USERNAME=david ADMIN_EMAIL=david@sanlucaristorante.com npx tsx prisma/seeds/link-admin.ts");
    process.exit(1);
  }

  const staff = await prisma.staff.findUnique({ where: { username: USERNAME }, select: { id: true, role: true, fullName: true } });
  if (!staff) {
    console.error(`✗ No existe el Staff "${USERNAME}". Revisa el username (es el de login, en minúsculas).`);
    process.exit(1);
  }
  if (staff.role !== "MANAGER") {
    await prisma.staff.update({ where: { id: staff.id }, data: { role: "MANAGER" } });
    console.log(`↻ Staff "${USERNAME}" (#${staff.id}) subido a MANAGER (requisito para tener panel).`);
  }

  const existing = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, staffId: true, role: true } });
  if (existing) {
    if (existing.staffId !== staff.id || existing.role !== "ADMIN") {
      await prisma.user.update({ where: { id: existing.id }, data: { staffId: staff.id, role: "ADMIN" } });
      console.log(`✅ User ${EMAIL} → ADMIN + ligado a Staff "${USERNAME}" (#${staff.id}).`);
    } else {
      console.log(`↩ User ${EMAIL} ya era ADMIN y estaba ligado a "${USERNAME}".`);
    }
  } else {
    const tempPassword = randomBytes(12).toString("base64url");
    await prisma.user.create({
      data: { name: staff.fullName, email: EMAIL, role: "ADMIN", passwordHash: await hashPassword(tempPassword), staffId: staff.id, acceptedTermsAt: new Date() },
    });
    console.log(`✅ User ADMIN creado y ligado a Staff "${USERNAME}" (#${staff.id}).`);
    console.log(`   email:    ${EMAIL}`);
    console.log(`   password: ${tempPassword}   ← respaldo para login por email; con el PIN NO lo necesita.`);
  }

  console.log(`\n➡  "${USERNAME}" entra con su PIN y cae en /admin/dashboard; su switch "Manager" abre /admin/piso con menú lateral (hamburguesa en móvil).`);
}

main()
  .catch((e) => { console.error("Error en link-admin:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
