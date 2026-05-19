import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Procedimiento de Eliminación de Datos — San Luca Ristorante",
  description:
    "Procedimiento para ejercer su derecho ARCO de Cancelación (eliminación de datos personales) en San Luca Ristorante.",
};

export default function EliminacionDatosPage() {
  return (
    <main className="privacy-page">
      <div className="privacy-container">
        <header className="privacy-header">
          <p className="privacy-eyebrow">SAN LUCA RISTORANTE</p>
          <h1 className="privacy-title">Procedimiento de Eliminación de Datos</h1>
          <p className="privacy-meta">Versión: 1.0 · 14 de mayo de 2026</p>
        </header>

        <section className="privacy-block">
          <p>
            Este documento describe cómo San Luca Ristorante atiende su{" "}
            <strong>derecho de Cancelación</strong> sobre los datos personales que
            usted nos ha proporcionado, en cumplimiento con la Ley Federal de
            Protección de Datos Personales en Posesión de los Particulares
            (LFPDPPP) y el{" "}
            <Link href="/privacidad#vi-sus-derechos-arco">
              Aviso de Privacidad §VI
            </Link>
            .
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="1-cuando-se-eliminan-sus-datos">
            1. ¿Cuándo se eliminan sus datos?
          </h2>
          <p>
            Procederemos a la eliminación de sus datos personales en cualquiera
            de los siguientes supuestos:
          </p>
          <ul>
            <li>
              <strong>A. Solicitud por correo:</strong> cuando usted nos escribe
              ejerciendo su derecho de Cancelación a{" "}
              <a href="mailto:privacidad@sanlucaristorante.com">
                privacidad@sanlucaristorante.com
              </a>
              .
            </li>
            <li>
              <strong>B. Eliminación desde la plataforma:</strong> cuando usted
              utiliza la opción <em>&ldquo;Eliminar mi cuenta&rdquo;</em>{" "}
              disponible en su panel de usuario.
            </li>
            <li>
              <strong>C. Vencimiento del plazo de retención:</strong> cuando los
              datos han superado el plazo establecido por la LFPDPPP y la
              normativa fiscal aplicable, y ya no existe finalidad legal que
              justifique su conservación.
            </li>
            <li>
              <strong>D. Orden de autoridad competente:</strong> cuando el INAI u
              otra autoridad ordene la eliminación de determinados datos
              personales.
            </li>
          </ul>
        </section>

        <section className="privacy-block">
          <h2 id="2-que-datos-se-eliminan">2. ¿Qué datos se eliminan?</h2>

          <h3 id="2-1-eliminacion-completa">2.1 Datos que se eliminan por completo</h3>
          <ul>
            <li>Nombre completo</li>
            <li>Dirección de correo electrónico</li>
            <li>Número de teléfono</li>
            <li>Fecha de nacimiento</li>
            <li>Foto de perfil e identificador de cuenta de Google</li>
            <li>Preferencias y configuración de la cuenta</li>
            <li>Tokens de sesión activos y códigos QR de check-in</li>
            <li>Historial de conversaciones de WhatsApp asociadas a su número</li>
          </ul>

          <h3 id="2-2-anonimizacion">2.2 Datos que se anonimizan</h3>
          <p>
            Los siguientes registros se conservan en forma anónima (sin
            posibilidad de re-identificarlo) para fines estadísticos internos y
            cumplimiento contable y fiscal, conforme al artículo 5 de la
            LFPDPPP:
          </p>
          <ul>
            <li>
              Historial de reservaciones (fecha, hora, número de comensales,
              área del restaurante)
            </li>
            <li>Registros de check-in (fecha y hora de asistencia)</li>
          </ul>
          <p>
            En ambos casos, su nombre y teléfono se reemplazan por valores
            anónimos y los registros quedan desvinculados de su persona.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="3-procedimiento-paso-a-paso">3. Procedimiento paso a paso</h2>
          <p>
            Las solicitudes que recibimos por correo (causal A) o que usted
            ejecuta desde la plataforma (causal B) siguen el mismo procedimiento
            estándar:
          </p>

          <h3>Paso 1 — Recepción</h3>
          <p>
            Registramos su solicitud con un folio único e indicamos la fecha y
            canal de recepción. En el caso de la opción{" "}
            <em>&ldquo;Eliminar mi cuenta&rdquo;</em> dentro de la plataforma,
            estos pasos se ejecutan automáticamente al momento de su confirmación.
          </p>

          <h3>Paso 2 — Verificación de identidad</h3>
          <p>
            Confirmamos que el solicitante es el titular de los datos. Si la
            solicitud llegó por correo, responderemos al correo registrado para
            confirmar. Si proviene de su cuenta autenticada, la verificación es
            automática.
          </p>

          <h3>Paso 3 — Evaluación de procedencia</h3>
          <p>
            Verificamos que no existan obligaciones legales que impidan la
            eliminación inmediata (por ejemplo, registros con valor fiscal
            vigente). Si existe alguna restricción legal, le notificaremos el
            motivo y el plazo estimado.
          </p>

          <h3>Paso 4 — Ejecución</h3>
          <p>
            Eliminamos los datos identificativos de nuestra base de datos,
            anonimizamos los registros conforme a la sección 2.2, y revocamos
            sus sesiones activas y códigos QR.
          </p>

          <h3>Paso 5 — Notificación</h3>
          <p>
            Le enviamos confirmación por correo electrónico indicando qué datos
            fueron eliminados y cuáles fueron anonimizados, junto con el folio
            de su solicitud.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="4-plazos-maximos">4. Plazos máximos</h2>
          <p>
            Conforme a la LFPDPPP, nos comprometemos a los siguientes plazos:
          </p>

          <div className="privacy-table-wrap">
            <table className="privacy-table">
              <caption className="privacy-table-caption">
                Plazos máximos del procedimiento
              </caption>
              <thead>
                <tr>
                  <th scope="col">Etapa</th>
                  <th scope="col">Plazo máximo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Acuse de recibo de su solicitud</th>
                  <td>2 días hábiles</td>
                </tr>
                <tr>
                  <th scope="row">Verificación de identidad</th>
                  <td>5 días hábiles</td>
                </tr>
                <tr>
                  <th scope="row">Evaluación de procedencia</th>
                  <td>5 días hábiles</td>
                </tr>
                <tr>
                  <th scope="row">Ejecución de la eliminación</th>
                  <td>Dentro de los 20 días hábiles desde la solicitud</td>
                </tr>
                <tr>
                  <th scope="row">Notificación de confirmación</th>
                  <td>Al día siguiente de la eliminación</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            En el caso de la opción <em>&ldquo;Eliminar mi cuenta&rdquo;</em>{" "}
            dentro de la plataforma, todos los pasos se completan en cuestión de
            segundos al momento de su confirmación.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="5-conservacion-de-evidencia">5. Conservación de evidencia</h2>
          <p>
            San Luca Ristorante conserva un registro de cada solicitud
            atendida (sin datos identificativos del titular eliminado) por un
            mínimo de <strong>3 años</strong>, como evidencia ante posibles
            auditorías del INAI o procesos judiciales, conforme a los artículos
            38-45 de la LFPDPPP.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="6-contacto">6. Contacto del Responsable</h2>
          <ul>
            <li><strong>Responsable:</strong> Ricardo Pájaro Camacho</li>
            <li>
              <strong>Correo de privacidad:</strong>{" "}
              <a href="mailto:privacidad@sanlucaristorante.com">
                privacidad@sanlucaristorante.com
              </a>
            </li>
            <li><strong>Teléfono:</strong> 449 468 6596</li>
            <li>
              <strong>Domicilio:</strong> Paseo de las Maravillas 303, El Llano,
              Jesús María, Aguascalientes
            </li>
          </ul>
          <p>
            Si considera que sus derechos no fueron atendidos correctamente,
            puede presentar una queja ante el{" "}
            <strong>
              Instituto Nacional de Transparencia, Acceso a la Información y
              Protección de Datos Personales (INAI)
            </strong>{" "}
            en{" "}
            <a href="https://www.inai.org.mx" target="_blank" rel="noopener noreferrer">
              www.inai.org.mx
            </a>
            .
          </p>
        </section>

        <section className="privacy-signature">
          <p>
            San Luca Ristorante · Jesús María, Aguascalientes, México · © 2026
            Ricardo Pájaro Camacho
          </p>
        </section>

        <footer className="privacy-footer">
          <Link href="/privacidad" className="privacy-back">
            ← Aviso de Privacidad
          </Link>
        </footer>
      </div>

      <style>{`
        .privacy-page {
          min-height: 100vh;
          background: #1c2628;
          color: #f5f1e8;
          padding: 60px 20px 80px;
        }
        .privacy-container {
          max-width: 820px;
          margin: 0 auto;
          background: rgba(245,241,232,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 48px 44px;
        }
        .privacy-header {
          border-bottom: 1px solid rgba(255,255,255,0.08);
          padding-bottom: 24px;
          margin-bottom: 32px;
        }
        .privacy-eyebrow {
          color: #ba843c;
          letter-spacing: 0.22em;
          font-size: 0.75rem;
          font-weight: 600;
          margin: 0 0 8px;
          text-transform: uppercase;
        }
        .privacy-title {
          font-size: 2rem;
          font-weight: 600;
          margin: 0 0 8px;
          letter-spacing: -0.02em;
        }
        .privacy-meta {
          color: rgba(245,241,232,0.5);
          font-size: 0.85rem;
          margin: 0;
        }
        .privacy-block {
          margin: 28px 0;
          line-height: 1.65;
          scroll-margin-top: 24px;
        }
        .privacy-block h2 {
          font-size: 1.15rem;
          font-weight: 600;
          color: #ba843c;
          margin: 0 0 14px;
        }
        .privacy-block h3 {
          font-size: 0.95rem;
          font-weight: 600;
          color: rgba(245,241,232,0.85);
          margin: 18px 0 8px;
          scroll-margin-top: 24px;
        }
        .privacy-block p {
          color: rgba(245,241,232,0.82);
          margin: 0 0 12px;
          font-size: 0.95rem;
        }
        .privacy-block ul {
          color: rgba(245,241,232,0.82);
          padding-left: 22px;
          margin: 0 0 14px;
          font-size: 0.95rem;
        }
        .privacy-block li {
          margin-bottom: 6px;
        }
        .privacy-block a {
          color: #d09a52;
          text-decoration: underline;
        }
        .privacy-block a:hover {
          color: #ba843c;
        }
        .privacy-table-wrap {
          overflow-x: auto;
          margin: 8px 0 18px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
        }
        .privacy-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.92rem;
          color: rgba(245,241,232,0.82);
        }
        .privacy-table-caption {
          caption-side: top;
          text-align: left;
          padding: 8px 14px;
          font-size: 0.78rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(245,241,232,0.45);
        }
        .privacy-table th,
        .privacy-table td {
          padding: 12px 14px;
          text-align: left;
          vertical-align: top;
          border-top: 1px solid rgba(255,255,255,0.06);
          line-height: 1.55;
        }
        .privacy-table thead th {
          background: rgba(186,132,60,0.08);
          color: #ba843c;
          font-weight: 600;
          letter-spacing: 0.04em;
          border-top: none;
        }
        .privacy-table tbody th {
          color: #f5f1e8;
          font-weight: 600;
          white-space: nowrap;
          width: 42%;
        }
        .privacy-signature {
          margin: 36px 0 0;
          padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .privacy-signature p {
          color: rgba(245,241,232,0.5);
          font-size: 0.85rem;
          margin: 0;
        }
        .privacy-footer {
          margin-top: 20px;
          padding-top: 20px;
          text-align: center;
        }
        .privacy-back {
          color: #ba843c;
          font-size: 0.9rem;
          text-decoration: none;
        }
        .privacy-back:hover {
          text-decoration: underline;
        }
        @media (max-width: 640px) {
          .privacy-container {
            padding: 30px 22px;
          }
          .privacy-title {
            font-size: 1.5rem;
          }
          .privacy-table th,
          .privacy-table td {
            padding: 10px 12px;
          }
          .privacy-table tbody th {
            width: 50%;
            white-space: normal;
          }
        }
      `}</style>
    </main>
  );
}
