import { prisma } from "../../lib/prisma";
import { hashPin, isValidPin } from "../../lib/staff-auth";

/**
 * Migra a Francesca al realm /staff igual que Ricardo: crea (o actualiza) su
 * Staff MANAGER con PIN y lo vincula a su User ADMIN (User.staffId). Con eso el
 * puente de identidad la deja entrar SOLO por PIN (su login por correo pasa a
 * quedar bloqueado con USE_PIN, porque será ADMIN con staffId). Idempotente.
 *
 * Rol MANAGER + User ADMIN = mismas vistas que Ricardo (/staff/capitan + botón
 * "Panel" → /admin, sesión ADMIN auto-generada → /admin y /crm).
 *
 * Correr en prod:  npm run db:seed:link-francesca
 *   (PIN por env opcional)  FRANCESCA_PIN=5678 npm run db:seed:link-francesca
 */

const EMAIL = process.env.FRANCESCA_EMAIL || "franccesca.hostes@sanluca.mx";
const USERNAME = (process.env.FRANCESCA_USERNAME || "francesca").toLowerCase();
const PIN = process.env.FRANCESCA_PIN || "5678";

async function main() {
  if (!isValidPin(PIN)) {
    console.error(`✗ PIN inválido "${PIN}". Debe ser exactamente 4 dígitos.`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, name: true, role: true, staffId: true } });
  if (!user) {
    console.error(
      `✗ No se encontró el User ${EMAIL}.\n` +
      `  Verifica el email de Francesca (FRANCESCA_EMAIL) y reintenta.`,
    );
    process.exit(1);
  }
  if (user.role !== "ADMIN") {
    console.error(`✗ El User ${EMAIL} tiene rol ${user.role}, se esperaba ADMIN. Aborta (no cambio roles a ciegas).`);
    process.exit(1);
  }

  const pinHash = await hashPin(PIN);
  const fullName = user.name?.trim() || "Francesca";

  // Find-or-create del Staff por username. Si ya existe, se actualiza su PIN/rol
  // (re-correr el seed re-establece el PIN a 5678).
  const existingStaff = await prisma.staff.findUnique({ where: { username: USERNAME }, select: { id: true } });
  let staffId: number;
  if (existingStaff) {
    await prisma.staff.update({
      where: { id: existingStaff.id },
      data: { pinHash, role: "MANAGER", active: true, fullName },
    });
    staffId = existingStaff.id;
    console.log(`↩ Staff "${USERNAME}" (#${staffId}) ya existía → actualizado (rol MANAGER, PIN, activo).`);
  } else {
    const created = await prisma.staff.create({
      data: { username: USERNAME, fullName, pinHash, role: "MANAGER", active: true },
      select: { id: true },
    });
    staffId = created.id;
    console.log(`✅ Staff "${USERNAME}" (#${staffId}) creado (MANAGER, activo).`);
  }

  if (user.staffId === staffId) {
    console.log(`↩ User ${EMAIL} ya estaba vinculado a Staff "${USERNAME}" (#${staffId}).`);
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { staffId } });
    console.log(`✅ Vinculado: User ${EMAIL} ↔ Staff "${USERNAME}" (#${staffId}).`);
  }

  console.log(`\n   Francesca entra ahora por PIN:  usuario "${USERNAME}"  ·  PIN ${PIN}`);
  console.log(`   Su login por CORREO queda bloqueado (USE_PIN), igual que Ricardo.`);
}

main()
  .catch((e) => { console.error("Error en link-francesca:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
