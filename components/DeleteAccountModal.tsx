"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Modal de confirmación de eliminación de cuenta (LFPDPPP §VI — Cancelación).
 * Doble check: el usuario debe (a) escribir literalmente "ELIMINAR" y (b)
 * marcar el checkbox de irreversibilidad antes de poder confirmar.
 *
 * El POST/DELETE va a /api/auth/account; on success se redirige al home.
 */
export function DeleteAccountModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [confirm, setConfirm]     = useState("");
  const [ack, setAck]             = useState(false);
  const [reason, setReason]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const canSubmit = confirm === "ELIMINAR" && ack && !submitting;

  async function handleDelete() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/account", {
        method:  "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ confirm: "ELIMINAR", reason: reason || undefined }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        throw new Error(data.error || "No se pudo eliminar la cuenta");
      }
      // Sesión revocada server-side; redirigimos a home.
      window.location.href = "/";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error inesperado";
      setError(msg);
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="dac-overlay" role="dialog" aria-modal="true" aria-labelledby="dac-title">
      <div className="dac-modal">
        <h2 id="dac-title" className="dac-title">Eliminar mi cuenta</h2>

        <p className="dac-lead">
          Esta acción es <strong>irreversible</strong>. Al continuar:
        </p>

        <ul className="dac-list">
          <li>
            <span className="dac-tag dac-tag--del">Se elimina</span>
            tu nombre, correo, teléfono, fecha de nacimiento, foto y ID de Google.
          </li>
          <li>
            <span className="dac-tag dac-tag--anon">Se anonimiza</span>
            tu historial de reservaciones (no se vincula a nadie, sólo se conserva
            agregado para fines contables).
          </li>
          <li>
            <span className="dac-tag dac-tag--del">Se cierra</span>
            tu sesión activa y se invalidan los códigos QR de check-in.
          </li>
        </ul>

        <p className="dac-note">
          Más detalles en el{" "}
          <Link href="/privacidad" target="_blank" rel="noopener noreferrer">
            Aviso de Privacidad
          </Link>{" "}
          y en tus{" "}
          <Link href="/privacidad#vi-sus-derechos-arco" target="_blank" rel="noopener noreferrer">
            derechos ARCO
          </Link>
          .
        </p>

        <label className="dac-field">
          <span className="dac-label">
            Escribe <code>ELIMINAR</code> para confirmar:
          </span>
          <input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="dac-input"
            autoComplete="off"
            spellCheck={false}
            placeholder="ELIMINAR"
            disabled={submitting}
          />
        </label>

        <label className="dac-field">
          <span className="dac-label">Motivo (opcional):</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            className="dac-textarea"
            rows={2}
            placeholder="Nos ayuda a mejorar — no es obligatorio"
            disabled={submitting}
          />
        </label>

        <label className="dac-check">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            disabled={submitting}
          />
          <span>Entiendo que esta acción es irreversible.</span>
        </label>

        {error && <div className="dac-error">⚠ {error}</div>}

        <div className="dac-actions">
          <button
            type="button"
            className="dac-btn dac-btn--cancel"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="dac-btn dac-btn--danger"
            onClick={handleDelete}
            disabled={!canSubmit}
          >
            {submitting ? "Eliminando…" : "Eliminar mi cuenta"}
          </button>
        </div>
      </div>

      <style>{`
        .dac-overlay {
          position: fixed; inset: 0;
          background: rgba(8,12,14,0.78);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          z-index: 1000;
          animation: dac-fade 0.18s ease-out;
        }
        @keyframes dac-fade { from { opacity: 0 } to { opacity: 1 } }
        .dac-modal {
          background: #1c2628;
          color: #f5f1e8;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 32px 30px;
          max-width: 520px;
          width: 100%;
          max-height: 92vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .dac-title {
          margin: 0 0 16px;
          font-size: 1.35rem;
          font-weight: 600;
          color: #e05555;
        }
        .dac-lead {
          margin: 0 0 16px;
          color: rgba(245,241,232,0.82);
          font-size: 0.95rem;
          line-height: 1.55;
        }
        .dac-list {
          margin: 0 0 16px;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .dac-list li {
          font-size: 0.9rem;
          color: rgba(245,241,232,0.78);
          line-height: 1.55;
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        .dac-tag {
          flex-shrink: 0;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-top: 2px;
        }
        .dac-tag--del  { background: rgba(224,85,85,0.14); color: #e05555; }
        .dac-tag--anon { background: rgba(186,132,60,0.16); color: #ba843c; }
        .dac-note {
          margin: 0 0 20px;
          padding: 10px 12px;
          background: rgba(245,241,232,0.04);
          border-left: 3px solid #ba843c;
          font-size: 0.85rem;
          color: rgba(245,241,232,0.65);
        }
        .dac-note a {
          color: #d09a52;
          text-decoration: underline;
        }
        .dac-field {
          display: block;
          margin: 0 0 14px;
        }
        .dac-label {
          display: block;
          font-size: 0.82rem;
          color: rgba(245,241,232,0.65);
          margin-bottom: 6px;
        }
        .dac-label code {
          background: rgba(224,85,85,0.12);
          color: #e05555;
          padding: 1px 6px;
          border-radius: 3px;
          font-size: 0.82rem;
          font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        }
        .dac-input, .dac-textarea {
          width: 100%;
          background: rgba(245,241,232,0.04);
          color: #f5f1e8;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          padding: 9px 12px;
          font-size: 0.92rem;
          font-family: inherit;
          box-sizing: border-box;
        }
        .dac-textarea { resize: vertical; min-height: 48px; }
        .dac-input:focus, .dac-textarea:focus {
          outline: none;
          border-color: #ba843c;
        }
        .dac-check {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin: 8px 0 18px;
          font-size: 0.9rem;
          color: rgba(245,241,232,0.82);
          cursor: pointer;
          user-select: none;
        }
        .dac-check input {
          margin-top: 3px;
          width: 16px;
          height: 16px;
          accent-color: #e05555;
          flex-shrink: 0;
        }
        .dac-error {
          background: rgba(224,85,85,0.12);
          color: #e05555;
          padding: 9px 12px;
          border-radius: 6px;
          font-size: 0.88rem;
          margin: 0 0 14px;
        }
        .dac-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 8px;
        }
        .dac-btn {
          padding: 10px 18px;
          border-radius: 6px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: opacity 0.15s, background 0.15s;
          border: 1px solid transparent;
        }
        .dac-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .dac-btn--cancel {
          background: transparent;
          color: rgba(245,241,232,0.7);
          border-color: rgba(255,255,255,0.12);
        }
        .dac-btn--cancel:hover:not(:disabled) {
          background: rgba(245,241,232,0.05);
        }
        .dac-btn--danger {
          background: #e05555;
          color: #fff;
        }
        .dac-btn--danger:hover:not(:disabled) {
          background: #c64646;
        }
      `}</style>
    </div>
  );
}
