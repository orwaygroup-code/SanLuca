import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aviso de Privacidad — San Luca Ristorante",
  description: "Aviso de Privacidad conforme a la LFPDPPP",
};

export default function PrivacidadPage() {
  return (
    <main className="privacy-page">
      <div className="privacy-container">
        <header className="privacy-header">
          <p className="privacy-eyebrow">SAN LUCA RISTORANTE</p>
          <h1 className="privacy-title">Aviso de Privacidad</h1>
          <p className="privacy-meta">Versión: 1.0 · 14 de mayo de 2026</p>
        </header>

        <section className="privacy-block">
          <p>
            En cumplimiento con la Ley Federal de Protección de Datos Personales en
            Posesión de los Particulares (LFPDPPP) y su Reglamento, este documento
            describe cómo recopilamos, usamos y protegemos su información personal a
            través del sitio web y la plataforma de San Luca Ristorante.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="i-identidad-del-responsable">I. Identidad del responsable</h2>
          <p>
            <strong>Ricardo Pájaro Camacho</strong> es el responsable del tratamiento
            de los datos personales que usted nos proporciona a través de la
            plataforma San Luca Ristorante.
          </p>
          <p>
            <strong>Datos de contacto del responsable</strong>
          </p>
          <ul>
            <li>
              <strong>Domicilio:</strong> Paseo de las Maravillas 303, El Llano,
              Jesús María, Aguascalientes
            </li>
            <li>
              <strong>Correo de privacidad:</strong>{" "}
              <a href="mailto:privacidad@sanlucaristorante.com">
                privacidad@sanlucaristorante.com
              </a>
            </li>
          </ul>
        </section>

        <section className="privacy-block">
          <h2 id="ii-datos-personales-que-recopilamos">
            II. Datos personales que recopilamos
          </h2>
          <p>
            Para brindarle nuestros servicios de reservación, recopilamos los
            siguientes datos personales:
          </p>
          <ul>
            <li>Nombre completo</li>
            <li>Correo electrónico</li>
            <li>Número de teléfono</li>
            <li>Fecha de nacimiento</li>
            <li>
              Historial de reservaciones: fecha, hora, número de comensales, área
              del restaurante y notas especiales
            </li>
            <li>Al iniciar sesión con Google: foto de perfil e ID de cuenta de Google</li>
          </ul>
          <p>
            <strong>Nota importante:</strong> El Responsable no recopila datos
            personales sensibles en los términos del artículo 3, fracción VI de la
            LFPDPPP.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="iii-finalidades-del-tratamiento">III. Finalidades del tratamiento</h2>

          <h3>Finalidades primarias — necesarias para el servicio</h3>
          <ul>
            <li>Crear y gestionar su cuenta de usuario en la plataforma</li>
            <li>Registrar, confirmar y administrar sus reservaciones</li>
            <li>Identificarle al momento del check-in mediante código QR</li>
            <li>Contactarle para confirmar, modificar o cancelar su reserva</li>
            <li>Enviar comunicaciones directamente relacionadas con su reservación activa</li>
          </ul>

          <h3>Finalidades secundarias — sujetas a su consentimiento</h3>
          <ul>
            <li>Informarle sobre promociones y eventos especiales del restaurante</li>
            <li>Solicitar su retroalimentación sobre la experiencia de visita</li>
          </ul>

          <p>
            Si no desea que sus datos sean utilizados para las finalidades
            secundarias, puede indicarlo escribiendo a{" "}
            <a href="mailto:privacidad@sanlucaristorante.com">
              privacidad@sanlucaristorante.com
            </a>{" "}
            o ajustando sus preferencias en la plataforma. Esto no afectará la
            prestación del servicio principal.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="iv-transferencia-de-datos-a-terceros">
            IV. Transferencia de datos a terceros
          </h2>
          <p>
            El Responsable no vende, arrienda ni transfiere sus datos personales a
            terceros con fines comerciales. Las únicas transferencias que se
            realizan son estrictamente necesarias para operar el servicio:
          </p>
          <ul>
            <li>
              <strong>Google LLC:</strong> Proveedor de autenticación (Google
              Sign-In). El tratamiento se rige por la{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Política de Privacidad de Google
              </a>
              .
            </li>
            <li>
              <strong>Proveedor de infraestructura en la nube:</strong> opera como
              encargado del tratamiento bajo las instrucciones del Responsable.
            </li>
          </ul>
          <p>
            Cualquier transferencia adicional requerirá su consentimiento expreso,
            salvo las excepciones previstas en el artículo 37 de la LFPDPPP.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="v-almacenamiento-y-seguridad">V. Almacenamiento y seguridad</h2>
          <p>
            Sus datos personales se almacenan en un servidor VPS ubicado en Europa
            o Estados Unidos, en una base de datos PostgreSQL con cifrado en reposo
            y controles de acceso. Las medidas de seguridad implementadas incluyen:
          </p>
          <ul>
            <li>Cifrado en tránsito mediante TLS 1.2+</li>
            <li>Autenticación de dos factores para accesos administrativos</li>
            <li>Auditorías de acceso periódicas</li>
          </ul>
          <p>
            En caso de que los datos se alojen fuera de México, el Responsable
            garantiza que el proveedor de infraestructura cuenta con niveles
            adecuados de protección conforme al artículo 36 de la LFPDPPP.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="vi-sus-derechos-arco">VI. Sus derechos ARCO</h2>
          <p>
            En términos de los artículos 22 al 35 de la LFPDPPP, usted tiene
            derecho a ejercer en cualquier momento:
          </p>

          <div className="privacy-table-wrap">
            <table className="privacy-table">
              <caption className="privacy-table-caption">Derechos ARCO</caption>
              <thead>
                <tr>
                  <th scope="col">Derecho</th>
                  <th scope="col">Descripción</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">A — Acceso</th>
                  <td>
                    Conocer qué datos personales tenemos sobre usted y cómo los
                    utilizamos.
                  </td>
                </tr>
                <tr>
                  <th scope="row">R — Rectificación</th>
                  <td>
                    Corregir o actualizar su información cuando sea inexacta o
                    incompleta.
                  </td>
                </tr>
                <tr>
                  <th scope="row">C — Cancelación</th>
                  <td>
                    Solicitar la eliminación de sus datos cuando ya no sean
                    necesarios para la finalidad que motivó su tratamiento.
                  </td>
                </tr>
                <tr>
                  <th scope="row">O — Oposición</th>
                  <td>
                    Oponerse al tratamiento de sus datos para finalidades
                    específicas.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>¿Cómo ejercer sus derechos?</h3>
          <p>
            Envíe su solicitud a{" "}
            <a href="mailto:privacidad@sanlucaristorante.com">
              privacidad@sanlucaristorante.com
            </a>{" "}
            indicando su nombre completo, correo electrónico registrado en la
            plataforma y una descripción clara del derecho que desea ejercer.
          </p>
          <p>
            Responderemos dentro de los <strong>20 días hábiles</strong>{" "}
            establecidos por la LFPDPPP.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="vii-retencion-de-datos">VII. Retención de datos</h2>
          <p>
            Sus datos se conservarán mientras mantenga una cuenta activa en la
            plataforma. El historial de reservaciones se conservará por el plazo
            que establezca la legislación aplicable (LFPDPPP y normativa fiscal)
            a partir de la fecha de cada reservación.
          </p>
          <p>
            Una vez que solicite la eliminación de su cuenta, sus datos
            identificativos serán eliminados o anonimizados, conservando
            únicamente los registros mínimos que exija la legislación vigente.
            Consulte el{" "}
            <Link href="/eliminacion-datos">
              Procedimiento de Eliminación de Datos
            </Link>{" "}
            para conocer el detalle de qué se elimina, qué se anonimiza y los
            plazos máximos aplicables.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="viii-cookies-y-tecnologias-de-rastreo">
            VIII. Cookies y tecnologías de rastreo
          </h2>
          <p>
            La plataforma utiliza tecnologías de almacenamiento local (tokens de
            sesión, identificadores de dispositivo) estrictamente necesarias para
            el funcionamiento del inicio de sesión y la seguridad de la cuenta.
          </p>
          <p>
            No utilizamos cookies de rastreo publicitario. Google puede utilizar
            sus propias tecnologías de seguimiento cuando usted interactúa con el
            botón &ldquo;Iniciar sesión con Google&rdquo;, sujeto a las políticas
            de privacidad de dicha empresa.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="ix-cambios-a-este-aviso-de-privacidad">
            IX. Cambios a este Aviso de Privacidad
          </h2>
          <p>
            El Responsable se reserva el derecho de modificar el presente Aviso de
            Privacidad en cualquier momento. Cualquier modificación será
            notificada a través de la plataforma y/o por correo electrónico con al
            menos <strong>15 días naturales</strong> de anticipación a su entrada
            en vigor.
          </p>
          <p>
            El uso continuo de la plataforma tras la publicación de los cambios
            constituirá su aceptación de la versión actualizada.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="x-autoridad-reguladora">X. Autoridad reguladora</h2>
          <p>
            Si considera que el Responsable ha vulnerado sus derechos de
            protección de datos personales, tiene derecho a presentar una queja
            ante el{" "}
            <strong>
              Instituto Nacional de Transparencia, Acceso a la Información y
              Protección de Datos Personales (INAI)
            </strong>
            .
          </p>
          <ul>
            <li>
              <strong>Sitio oficial:</strong>{" "}
              <a href="https://www.inai.org.mx" target="_blank" rel="noopener noreferrer">
                www.inai.org.mx
              </a>
            </li>
            <li>
              <strong>Fundamento:</strong> artículos 38-45 de la LFPDPPP y
              artículos 68-76 de su Reglamento.
            </li>
          </ul>
        </section>

        <section className="privacy-signature">
          <p>
            San Luca Ristorante · Jesús María, Aguascalientes, México · © 2026
            Ricardo Pájaro Camacho
          </p>
        </section>

        <footer className="privacy-footer">
          <Link href="/login?mode=register" className="privacy-back">
            ← Volver al registro
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
          width: 32%;
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
            width: 38%;
            white-space: normal;
          }
        }
      `}</style>
    </main>
  );
}
