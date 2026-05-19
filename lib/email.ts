/**
 * Email helper.
 *
 * TODO: integrar Resend (o equivalente) — ver nota del wiki en
 * `07 - Legal/Data Deletion Procedure.md` §E. Hasta entonces, los correos
 * sólo se loguean a stdout para que el flujo legal no quede bloqueado.
 */

export interface SendMailArgs {
  to:      string;
  subject: string;
  text:    string;
  html?:   string;
}

export async function sendMail(args: SendMailArgs): Promise<void> {
  // TODO: reemplazar por Resend (process.env.RESEND_API_KEY) o SMTP.
  console.log("[EMAIL][stub] →", args.to, "·", args.subject);
  if (process.env.NODE_ENV !== "production") {
    console.log("[EMAIL][stub] body:\n" + args.text);
  }
}

/**
 * Plantilla del correo de confirmación de eliminación de cuenta
 * (LFPDPPP §VI — derecho de Cancelación).
 */
export function buildAccountDeletionEmail(args: {
  name:  string | null;
  folio: string;
}): { subject: string; text: string } {
  const subject = `Confirmación de eliminación de cuenta — Folio ${args.folio}`;
  const greeting = args.name && args.name.trim().length > 0
    ? `Hola ${args.name.trim()},`
    : "Hola,";
  const text = [
    greeting,
    "",
    "Confirmamos que hemos eliminado su cuenta de San Luca Ristorante conforme",
    "a su derecho de Cancelación (LFPDPPP §VI).",
    "",
    `· Folio de la solicitud: ${args.folio}`,
    "· Datos eliminados: nombre, correo, teléfono, fecha de nacimiento, foto e ID de Google.",
    "· Datos anonimizados: historial de reservaciones (sin posibilidad de re-identificación).",
    "",
    "Su sesión activa fue revocada. Si en el futuro desea volver, deberá registrarse",
    "de nuevo.",
    "",
    "Si tiene preguntas, escríbanos a privacidad@sanlucaristorante.com.",
    "",
    "— San Luca Ristorante",
  ].join("\n");
  return { subject, text };
}
