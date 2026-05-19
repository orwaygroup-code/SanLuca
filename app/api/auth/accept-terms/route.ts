import { NextRequest, NextResponse } from "next/server";
import { withApp } from "@/lib/prismaApp";
import { runWithSession } from "@/lib/session-context";
import { getSession } from "@/lib/auth-server";
import type { ApiResponse } from "@/types";

/**
 * Versión vigente de los documentos legales que el usuario acepta.
 * Mantener en sync con [[Privacy Notice]] y [[Terms and Conditions]]
 * del wiki. Si cambia, los usuarios con `acceptedTermsVersion < TERMS_VERSION`
 * verán de nuevo el modal de re-aceptación.
 */
const TERMS_VERSION = "1.0";

/**
 * POST /api/auth/accept-terms 🍪
 *
 * Re-aceptación de Aviso de Privacidad + T&C para:
 *  - Usuarios pre-existentes (creados antes de la feature, con `acceptedTermsAt = null`).
 *  - Usuarios que aceptaron una versión previa.
 *
 * El modal client-side (`components/AcceptTermsModal.tsx`) llama aquí
 * cuando el usuario marca el checkbox y pulsa "Acepto y continuar".
 */
export async function POST(req: NextRequest) {
  const s = await getSession(req);
  if (!s) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  try {
    await runWithSession(s, () =>
      withApp((db) =>
        db.user.update({
          where: { id: s.userId },
          data:  {
            acceptedTermsAt:      new Date(),
            acceptedTermsVersion: TERMS_VERSION,
          },
        })
      )
    );
    return NextResponse.json<ApiResponse>({ success: true });
  } catch (err) {
    console.error("[API] POST /api/auth/accept-terms error:", err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "accept_failed" },
      { status: 500 }
    );
  }
}
