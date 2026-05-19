"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session-client";

/**
 * Versión vigente de Aviso de Privacidad + T&C. Debe coincidir con el
 * `TERMS_VERSION` del servidor (`app/api/auth/register/route.ts` y
 * `app/api/auth/accept-terms/route.ts`). Si bump-ea aquí pero no en server,
 * los usuarios verán el modal en loop.
 */
export const CURRENT_TERMS_VERSION = "1.0";

/**
 * Muestra el modal cuando el usuario autenticado:
 *  - no tiene `acceptedTermsAt` (usuario pre-feature), o
 *  - tiene una versión distinta a la vigente.
 *
 * Decisión arquitectónica: client-side (no middleware) porque la verificación
 * requiere DB y middleware corre en edge runtime sin Prisma. Ver §D del wiki
 * `Terms and Conditions.md`.
 */
export function AcceptTermsModal() {
  const session = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mientras carga la sesión real desde /api/auth/me no decidimos nada —
  // evita un flash del modal en hidratación basada en localStorage.
  if (session.loading || !session.user) return null;

  const accepted = session.user.acceptedTermsAt;
  const version  = session.user.acceptedTermsVersion;
  const needsAcceptance = !accepted || version !== CURRENT_TERMS_VERSION;
  if (!needsAcceptance) return null;

  return <Inner session={session} submitting={submitting} setSubmitting={setSubmitting} error={error} setError={setError} />;
}

function Inner({
  session,
  submitting,
  setSubmitting,
  error,
  setError,
}: {
  session: ReturnType<typeof useSession>;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
}) {
  const [checked, setChecked] = useState(false);

  async function handleAccept() {
    if (!checked || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/accept-terms", {
        method: "POST",
        credentials: "same-origin",
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        throw new Error(d.error ?? "accept_failed");
      }
      await session.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await session.logout();
    window.location.href = "/";
  }

  return (
    <div className="atm-overlay" role="dialog" aria-modal="true" aria-labelledby="atm-title">
      <div className="atm-modal">
        <h2 id="atm-title" className="atm-title">Actualización de términos legales</h2>
        <p className="atm-lead">
          Antes de continuar necesitamos que aceptes nuestros documentos vigentes:
        </p>

        <ul className="atm-list">
          <li>
            <Link href="/privacidad" target="_blank" rel="noopener noreferrer">
              <strong>Aviso de Privacidad</strong>
            </Link>{" "}
            — cómo recopilamos y protegemos tus datos (LFPDPPP).
          </li>
          <li>
            <Link href="/terminos" target="_blank" rel="noopener noreferrer">
              <strong>Términos y Condiciones</strong>
            </Link>{" "}
            — reglas de uso de la plataforma.
          </li>
        </ul>

        <p className="atm-note">
          Tu cuenta sigue activa. Sólo necesitamos tu aceptación para seguir
          ofreciéndote el servicio.
        </p>

        <label className="atm-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            disabled={submitting}
          />
          <span>
            He leído y acepto el <strong>Aviso de Privacidad</strong> y los{" "}
            <strong>Términos y Condiciones</strong>.
          </span>
        </label>

        {error && <div className="atm-error">⚠ {error}</div>}

        <div className="atm-actions">
          <button
            type="button"
            className="atm-btn atm-btn--secondary"
            onClick={handleLogout}
            disabled={submitting}
          >
            Cerrar sesión
          </button>
          <button
            type="button"
            className="atm-btn atm-btn--primary"
            onClick={handleAccept}
            disabled={!checked || submitting}
          >
            {submitting ? "Guardando…" : "Acepto y continuar"}
          </button>
        </div>
      </div>

      <style>{`
        .atm-overlay {
          position: fixed; inset: 0;
          background: rgba(8,12,14,0.85);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          z-index: 1100;
          animation: atm-fade 0.18s ease-out;
        }
        @keyframes atm-fade { from { opacity: 0 } to { opacity: 1 } }
        .atm-modal {
          background: #1c2628;
          color: #f5f1e8;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 30px 28px;
          max-width: 500px;
          width: 100%;
          max-height: 92vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .atm-title {
          margin: 0 0 14px;
          font-size: 1.25rem;
          font-weight: 600;
          color: #ba843c;
          letter-spacing: -0.01em;
        }
        .atm-lead {
          margin: 0 0 14px;
          color: rgba(245,241,232,0.82);
          font-size: 0.95rem;
          line-height: 1.55;
        }
        .atm-list {
          margin: 0 0 14px;
          padding-left: 22px;
          font-size: 0.92rem;
          color: rgba(245,241,232,0.85);
          line-height: 1.6;
        }
        .atm-list li { margin-bottom: 6px; }
        .atm-list a, .atm-modal a {
          color: #d09a52;
          text-decoration: underline;
        }
        .atm-note {
          margin: 0 0 16px;
          padding: 10px 12px;
          background: rgba(245,241,232,0.04);
          border-left: 3px solid #ba843c;
          font-size: 0.85rem;
          color: rgba(245,241,232,0.65);
        }
        .atm-check {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin: 4px 0 16px;
          font-size: 0.9rem;
          color: rgba(245,241,232,0.85);
          cursor: pointer;
          user-select: none;
          line-height: 1.5;
        }
        .atm-check input {
          margin-top: 3px;
          width: 16px;
          height: 16px;
          accent-color: #ba843c;
          flex-shrink: 0;
        }
        .atm-error {
          background: rgba(224,85,85,0.12);
          color: #e05555;
          padding: 9px 12px;
          border-radius: 6px;
          font-size: 0.88rem;
          margin: 0 0 14px;
        }
        .atm-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        .atm-btn {
          padding: 10px 18px;
          border-radius: 6px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          border: 1px solid transparent;
          transition: opacity 0.15s, background 0.15s;
        }
        .atm-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .atm-btn--secondary {
          background: transparent;
          color: rgba(245,241,232,0.7);
          border-color: rgba(255,255,255,0.12);
        }
        .atm-btn--secondary:hover:not(:disabled) {
          background: rgba(245,241,232,0.05);
        }
        .atm-btn--primary {
          background: #ba843c;
          color: #1c2628;
        }
        .atm-btn--primary:hover:not(:disabled) {
          background: #d09a52;
        }
      `}</style>
    </div>
  );
}
