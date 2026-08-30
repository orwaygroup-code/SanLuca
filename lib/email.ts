/**
 * Envío de correo vía la API HTTP de Resend (sin dependencias: fetch nativo).
 *
 * Requiere dos variables de entorno:
 *   RESEND_API_KEY  — clave de la cuenta.
 *   MAIL_FROM       — remitente verificado, p. ej. "San Luca <no-reply@sanlucaristorante.com>".
 *
 * Antes esta función sólo escribía a stdout y SIEMPRE resolvía. El problema no
 * era que no enviara —eso estaba anotado como pendiente— sino que fingía
 * éxito: quien la llama envuelve la llamada en try/catch para registrar el
 * fallo (ver app/api/auth/account/route.ts §7), y ese catch nunca se
 * disparaba. El equipo quedaba creyendo que el correo de confirmación de baja
 * había salido cuando no existía. Ahora, sin configuración, en producción
 * lanza; el llamador lo registra y el aviso puede darse a mano.
 */

export interface SendMailArgs {
  to:      string;
  subject: string;
  text:    string;
  html?:   string;
}

export async function sendMail(args: SendMailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    // En desarrollo basta con verlo por consola; en producción es un fallo real.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[EMAIL] sin configurar (RESEND_API_KEY/MAIL_FROM). No se envía a ${args.to} · ${args.subject}`);
      console.warn("[EMAIL] cuerpo:\n" + args.text);
      return;
    }
    throw new Error("Envío de correo no configurado: faltan RESEND_API_KEY y/o MAIL_FROM.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      ...(args.html ? { html: args.html } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend respondió ${res.status}: ${detail.slice(0, 300)}`);
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
