import { NextRequest, NextResponse } from "next/server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { getSession } from "@/lib/auth-server";
import { clearSessionCookieString } from "@/lib/session";
import {
  ANON_SYSTEM_NAME,
  ANON_SYSTEM_PHONE,
  ensureAnonymousUserId,
} from "@/lib/anonymousUser";
import { nextArcoFolio } from "@/lib/arcoFolio";
import { sendMail, buildAccountDeletionEmail } from "@/lib/email";
import type { ApiResponse } from "@/types";

/**
 * DELETE /api/auth/account
 *
 * Causal B del manual de eliminación de datos personales (LFPDPPP §VI):
 * el titular ejerce el derecho de Cancelación desde la propia plataforma.
 *
 * Body opcional: { confirm: "ELIMINAR", reason?: string }
 *
 * Atómico: anonimiza reservaciones, borra mensajes WA, registra ArcoRequest
 * y elimina al `User` dentro de una sola transacción. Si algo falla,
 * rollback completo y la sesión queda intacta.
 */
export async function DELETE(req: NextRequest) {
  const s = await getSession(req);
  if (!s) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  let body: { confirm?: string; reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    // sin body es válido — confirm es opcional desde el servidor
  }
  if (body.confirm && body.confirm !== "ELIMINAR") {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "invalid_confirmation" },
      { status: 400 },
    );
  }

  try {
    const result = await runWithSession(s, () =>
      withApp(async (db) => {
        console.log(`[ARCO] start deletion for user=${s.userId}`);

        const user = await db.user.findUnique({
          where:  { id: s.userId },
          select: { id: true, name: true, email: true, phone: true },
        });
        if (!user) {
          throw Object.assign(new Error("user_not_found"), { code: 404 });
        }
        console.log(`[ARCO] loaded user email=${user.email} phone=${user.phone || "(empty)"}`);

        // 1. Asegurar user-sistema "anónimo".
        const anonId = await ensureAnonymousUserId(db);
        console.log(`[ARCO] anonymous user id=${anonId}`);

        // 2. Reasignar reservaciones owned al user anónimo + scrub PII del huésped.
        //    Reservation.user tiene onDelete: Cascade — sin este paso, las reservas
        //    se borrarían al borrar el User (perderíamos métricas históricas).
        const reassigned = await db.reservation.updateMany({
          where: { userId: user.id },
          data:  {
            userId:     anonId,
            guestName:  ANON_SYSTEM_NAME,
            guestPhone: ANON_SYSTEM_PHONE,
          },
        });
        console.log(`[ARCO] anonymized ${reassigned.count} owned reservations`);

        // 3. Limpiar conversaciones de WhatsApp por teléfono.
        //    El schema sólo enlaza por phone (unique), no por userId.
        let waConvsDeleted = 0;
        const phone = user.phone?.trim();
        if (phone) {
          const conv = await db.whatsAppConversation.findUnique({
            where:  { phone },
            select: { id: true },
          });
          if (conv) {
            // Mensajes caen por cascade al borrar la conversación.
            await db.whatsAppConversation.delete({ where: { id: conv.id } });
            waConvsDeleted = 1;
          }
        }
        console.log(`[ARCO] deleted ${waConvsDeleted} WA conversation(s)`);

        // 4. Crear ArcoRequest dentro de la misma transacción.
        //    Capturamos `user.email` antes de borrar el User row para poder
        //    rastrearlo después y enviarle el correo de confirmación.
        const folio = await nextArcoFolio(db);
        const arco = await db.arcoRequest.create({
          data: {
            folio,
            channel:           "APP",
            rightExercised:    "CANCELLATION",
            requesterEmail:    user.email,
            requesterName:     user.name,
            identityVerifiedAt: new Date(), // la sesión válida = identidad verificada
            evaluationResult:  "Procedente — solicitud desde la app",
            executedAt:        new Date(),
            executedBy:        user.id,
            status:            "COMPLETED",
            notes:             body.reason?.slice(0, 500) ?? null,
          },
          select: { id: true, folio: true },
        });
        console.log(`[ARCO] inserted request folio=${arco.folio}`);

        // 5. Borrar el User. Reservation.createdBy es SetNull, así que las
        //    reservas creadas por staff (donde este user no era el dueño)
        //    sólo pierden la referencia. WhatsAppConversation ya está limpia.
        await db.user.delete({ where: { id: user.id } });
        console.log(`[ARCO] deleted user id=${user.id}`);

        // 6. Marcar notifiedAt — el envío del mail va fuera de la tx para
        //    no bloquear commit por un timeout de SMTP.
        const captured = {
          email: user.email,
          name:  user.name,
          folio: arco.folio,
        };
        return captured;
      }),
    );

    // 7. Email post-transacción (fuera del lock). Falla silenciosa: ya
    //    quedó registrado en ArcoRequest, el equipo puede reintentar manual.
    try {
      const tpl = buildAccountDeletionEmail({ name: result.name, folio: result.folio });
      await sendMail({ to: result.email, subject: tpl.subject, text: tpl.text });
      // notifiedAt lo actualiza el admin desde el CRM al confirmar entrega.
    } catch (mailErr) {
      console.error("[ARCO] mail send failed (non-fatal):", mailErr);
    }

    const res = NextResponse.json<ApiResponse>({
      success: true,
      data: { folio: result.folio },
    });
    res.headers.set("Set-Cookie", clearSessionCookieString());
    return res;
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    console.error("[ARCO] deletion failed:", err);
    const status = typeof e?.code === "number" ? e.code : 500;
    return NextResponse.json<ApiResponse>(
      { success: false, error: e?.message ?? "deletion_failed" },
      { status },
    );
  }
}
