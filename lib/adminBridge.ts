import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { hashPassword } from "./auth";

/**
 * Puente de identidad User ↔ Staff: lo que realmente da acceso a /admin y /crm.
 *
 * El panel se construyó sobre el realm de User (cookie sl_session) mientras la
 * operación vive en el de Staff (cookie sl_staff, PIN). El login de staff los
 * une: si el Staff tiene un User ADMIN/HOSTES ligado por User.staffId, emite
 * TAMBIÉN la sesión de admin y el mismo PIN abre el panel.
 *
 * Ese vínculo se creaba a mano, con un script por persona. Consecuencia: dar de
 * alta a alguien como MANAGER desde /admin/employees NO le daba acceso al
 * panel —el puesto decía una cosa y los privilegios otra—, y había que
 * recordar correr un script. Aquí se mantiene solo.
 *
 * Dos salvaguardas deliberadas:
 *  - Si el correo derivado ya pertenece a OTRA persona, no se toca esa cuenta:
 *    se informa y no se concede acceso. Reutilizarla sería entregarle a un
 *    empleado la identidad de un comensal.
 *  - Al dejar de ser MANAGER se revoca el rol del User ligado. El vínculo se
 *    conserva para auditoría, pero sin ADMIN deja de abrir el panel.
 */

const ADMIN_EMAIL_DOMAIN = "sanlucaristorante.com";

export type BridgeResult = "granted" | "kept" | "revoked" | "email-taken" | "noop";

export async function syncAdminBridge(
  staffId: number,
  role: string,
  who: { username: string; fullName: string },
): Promise<BridgeResult> {
  const linked = await prisma.user.findUnique({
    where: { staffId },
    select: { id: true, role: true },
  });

  // Cualquier puesto que no sea MANAGER pierde el panel.
  if (role !== "MANAGER") {
    if (linked && (linked.role === "ADMIN" || linked.role === "HOSTES")) {
      await prisma.user.update({ where: { id: linked.id }, data: { role: "CUSTOMER" } });
      return "revoked";
    }
    return "noop";
  }

  if (linked) {
    if (linked.role === "ADMIN" || linked.role === "HOSTES") return "kept";
    await prisma.user.update({ where: { id: linked.id }, data: { role: "ADMIN" } });
    return "granted";
  }

  const email = `${who.username.toLowerCase()}@${ADMIN_EMAIL_DOMAIN}`;
  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true, staffId: true } });
  if (taken && taken.staffId !== staffId) return "email-taken";

  if (taken) {
    await prisma.user.update({ where: { id: taken.id }, data: { role: "ADMIN", staffId } });
    return "granted";
  }

  // Contraseña de respaldo para el login por correo; con el PIN no se usa.
  await prisma.user.create({
    data: {
      name: who.fullName,
      email,
      role: "ADMIN",
      passwordHash: await hashPassword(randomBytes(12).toString("base64url")),
      staffId,
      acceptedTermsAt: new Date(),
    },
  });
  return "granted";
}
