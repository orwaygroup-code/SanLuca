import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos y Condiciones — San Luca Ristorante",
  description: "Términos y condiciones de uso de la plataforma San Luca Ristorante.",
};

export default function TerminosPage() {
  return (
    <main className="privacy-page">
      <div className="privacy-container">
        <header className="privacy-header">
          <p className="privacy-eyebrow">SAN LUCA RISTORANTE</p>
          <h1 className="privacy-title">Términos y Condiciones</h1>
          <p className="privacy-meta">Versión: 1.0 · 14 de mayo de 2026</p>
        </header>

        <section className="privacy-block">
          <p>
            San Luca Ristorante — Plataforma de reservaciones.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="1-aceptacion">1. Aceptación de los Términos</h2>
          <p>
            El acceso y uso del sitio web y la plataforma San Luca Ristorante (en
            adelante, &ldquo;la Plataforma&rdquo;) implica la aceptación plena y
            sin reservas de los presentes Términos y Condiciones (en adelante,
            &ldquo;los Términos&rdquo;).
          </p>
          <p>
            Si usted no está de acuerdo con alguno de estos Términos, deberá
            abstenerse de utilizar la Plataforma. El uso continuado de la misma
            después de cualquier modificación constituirá su aceptación de los
            cambios realizados.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="2-descripcion-del-servicio">2. Descripción del Servicio</h2>
          <p>
            San Luca Ristorante pone a disposición de sus clientes una plataforma
            que permite:
          </p>
          <ul>
            <li>Realizar, consultar, modificar y cancelar reservaciones en el restaurante</li>
            <li>Gestionar una cuenta personal de usuario</li>
            <li>Realizar el check-in mediante código QR al momento de llegada</li>
            <li>Recibir confirmaciones y notificaciones relacionadas con su reservación</li>
            <li>Iniciar sesión de forma segura a través de Google Sign-In</li>
          </ul>
          <p>
            El Responsable se reserva el derecho de modificar, suspender o
            descontinuar, temporal o permanentemente, la Plataforma o cualquiera
            de sus funciones, con o sin previo aviso.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="3-cuenta-de-usuario">3. Cuenta de Usuario</h2>

          <h3 id="3-1-registro">3.1 Registro</h3>
          <p>
            Para utilizar las funcionalidades de la Plataforma, usted deberá
            crear una cuenta proporcionando información veraz, completa y
            actualizada. Usted es responsable de mantener la confidencialidad de
            sus credenciales de acceso.
          </p>

          <h3 id="3-2-responsabilidad-del-usuario">3.2 Responsabilidad del Usuario</h3>
          <p>Usted se compromete a:</p>
          <ul>
            <li>Proporcionar información verdadera y actualizada al momento del registro</li>
            <li>No ceder, transferir ni permitir el uso de su cuenta a terceros</li>
            <li>Notificar inmediatamente al Responsable ante cualquier uso no autorizado de su cuenta</li>
            <li>Utilizar la Plataforma únicamente para los fines establecidos en estos Términos</li>
          </ul>

          <h3 id="3-3-cancelacion-de-cuenta">3.3 Cancelación de Cuenta</h3>
          <p>
            El Responsable se reserva el derecho de suspender o cancelar su
            cuenta en caso de incumplimiento de los presentes Términos, uso
            fraudulento o cualquier actividad que afecte la integridad del
            servicio.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="4-politica-de-reservaciones">4. Política de Reservaciones</h2>

          <h3 id="4-1-realizacion-de-reservas">4.1 Realización de Reservas</h3>
          <p>
            Las reservaciones están sujetas a disponibilidad. La confirmación se
            realizará a través de la Plataforma y/o por correo electrónico
            dentro de las 24 horas siguientes a su solicitud.
          </p>

          <h3 id="4-2-modificaciones">4.2 Modificaciones</h3>
          <p>
            El usuario podrá modificar su reservación a través de la Plataforma
            con un mínimo de <strong>2 horas de anticipación</strong> a la hora
            reservada, sujeto a disponibilidad.
          </p>

          <h3 id="4-3-cancelaciones">4.3 Cancelaciones</h3>
          <p>
            Las cancelaciones deberán realizarse con al menos{" "}
            <strong>1 hora de anticipación</strong> a través de la Plataforma o
            comunicándose directamente con el restaurante. Las cancelaciones
            tardías o la no presentación podrán resultar en restricciones
            temporales del servicio.
          </p>

          <h3 id="4-4-check-in">4.4 Check-in</h3>
          <p>
            Al llegar al restaurante, el usuario deberá presentar el código QR
            generado en la Plataforma al personal del establecimiento para
            confirmar su asistencia. El código QR es personal e intransferible.
          </p>
          <p>
            San Luca Ristorante se reserva el derecho de admisión. La
            disponibilidad de mesas puede variar y no se garantiza en todos los
            casos, incluso con reservación previa ante situaciones de fuerza
            mayor.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="5-uso-aceptable">5. Uso Aceptable</h2>
          <p>Queda expresamente prohibido el uso de la Plataforma para:</p>
          <ul>
            <li>Realizar reservaciones fraudulentas o con información falsa</li>
            <li>Acceder de forma no autorizada a los sistemas o bases de datos del Responsable</li>
            <li>Interferir con el funcionamiento normal de la Plataforma</li>
            <li>Transmitir virus, malware u otro código dañino</li>
            <li>Recopilar datos de otros usuarios sin su consentimiento</li>
            <li>Realizar ingeniería inversa o descompilar la Plataforma</li>
          </ul>
          <p>
            El incumplimiento de estas prohibiciones podrá dar lugar a la
            cancelación inmediata de la cuenta y, en su caso, a las acciones
            legales correspondientes.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="6-propiedad-intelectual">6. Propiedad Intelectual</h2>
          <p>
            Todos los derechos de propiedad intelectual sobre la Plataforma,
            incluyendo su diseño, código fuente, logotipos, textos, imágenes y
            demás contenidos, son propiedad exclusiva de{" "}
            <strong>Ricardo Pájaro Camacho</strong> o de sus licenciantes.
          </p>
          <p>
            Queda prohibida su reproducción, distribución, modificación o uso
            comercial sin autorización previa y por escrito del Responsable.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="7-privacidad-y-proteccion-de-datos">
            7. Privacidad y Protección de Datos
          </h2>
          <p>
            El tratamiento de sus datos personales se rige por el{" "}
            <Link href="/privacidad">Aviso de Privacidad de San Luca Ristorante</Link>,
            disponible en la Plataforma y en el sitio web del restaurante. Al
            aceptar estos Términos, usted confirma haber leído y comprendido
            dicho Aviso de Privacidad.
          </p>
          <p>
            Para cualquier consulta relacionada con el tratamiento de sus datos
            personales puede contactarnos en:{" "}
            <a href="mailto:privacidad@sanlucaristorante.com">
              privacidad@sanlucaristorante.com
            </a>
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="8-limitacion-de-responsabilidad">
            8. Limitación de Responsabilidad
          </h2>
          <p>El Responsable no será responsable por:</p>
          <ul>
            <li>
              Interrupciones temporales del servicio por mantenimiento, fallas
              técnicas o causas de fuerza mayor
            </li>
            <li>
              Pérdida de datos derivada del uso incorrecto de la Plataforma por
              parte del usuario
            </li>
            <li>
              Daños indirectos, incidentales o consecuentes derivados del uso o
              imposibilidad de uso de la Plataforma
            </li>
            <li>Contenido o servicios de terceros accesibles a través de la Plataforma</li>
          </ul>
          <p>
            En cualquier caso, la responsabilidad máxima del Responsable no
            excederá el monto equivalente al valor del servicio directamente
            relacionado con el daño causado.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="9-modificaciones-a-los-terminos">9. Modificaciones a los Términos</h2>
          <p>
            El Responsable se reserva el derecho de actualizar los presentes
            Términos en cualquier momento. Las modificaciones serán notificadas
            a través de la Plataforma y/o por correo electrónico con al menos{" "}
            <strong>15 días naturales</strong> de anticipación a su entrada en
            vigor.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="10-legislacion-aplicable-y-jurisdiccion">
            10. Legislación Aplicable y Jurisdicción
          </h2>
          <p>
            Los presentes Términos se rigen por las leyes de los Estados Unidos
            Mexicanos. Para la resolución de cualquier controversia derivada de
            su interpretación o cumplimiento, las partes se someten expresamente
            a la jurisdicción de los tribunales competentes de la ciudad de{" "}
            <strong>Aguascalientes</strong>, renunciando a cualquier otro fuero
            que pudiera corresponderles.
          </p>
        </section>

        <section className="privacy-block">
          <h2 id="11-contacto">11. Contacto</h2>
          <ul>
            <li><strong>Responsable:</strong> Ricardo Pájaro Camacho</li>
            <li>
              <strong>Correo general:</strong>{" "}
              <a href="mailto:Sanlucaterraza@gmail.com">Sanlucaterraza@gmail.com</a>
            </li>
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
        }
      `}</style>
    </main>
  );
}
