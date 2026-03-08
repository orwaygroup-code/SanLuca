"use client";

import { colors, fonts } from "@/config/theme";
import Button from "@/components/ui/Button";
import { Divider } from "@/components/ui/SectionHead";

export default function Featured() {
  return (
    <section
      id="reservaciones"
      style={{
        background: colors.cream,
        padding: "clamp(64px, 10vw, 120px) 24px",
        position: "relative",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
            gap: 36,
            alignItems: "stretch",
          }}
        >
          {/* Dark Content Block */}
          <div
            style={{
              background: colors.dark,
              padding: "clamp(36px, 5vw, 52px)",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 20px 56px rgba(28,38,40,0.2)",
            }}
          >
            {/* Texture */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.04,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='t'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='6'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23t)'/%3E%3C/svg%3E")`,
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative" }}>
              <div
                style={{
                  fontFamily: fonts.script,
                  fontSize: "1.15rem",
                  color: colors.peru,
                  marginBottom: 10,
                }}
              >
                Esperienza speciale
              </div>
              <h2
                style={{
                  fontFamily: fonts.primary,
                  fontSize: "clamp(1.5rem, 3vw, 2rem)",
                  fontWeight: 800,
                  color: colors.cream,
                  margin: "0 0 14px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  lineHeight: 1.15,
                }}
              >
                Cena Privada
                <br />
                <span style={{ color: colors.peru }}>Chef&apos;s Table</span>
              </h2>
              <p
                style={{
                  fontFamily: fonts.primary,
                  fontSize: "0.95rem",
                  fontWeight: 400,
                  color: "rgba(245,241,232,0.5)",
                  lineHeight: 1.8,
                  marginBottom: 28,
                }}
              >
                Experiencia gastronómica exclusiva de 7 tiempos, maridada con
                vinos italianos de reserva. Para grupos de hasta 8 personas.
              </p>
              <Button>Reservar Experiencia</Button>
            </div>
          </div>

          {/* Reservation Card */}
          <div
            style={{
              background: colors.white,
              padding: "clamp(36px, 5vw, 52px)",
              textAlign: "center",
              boxShadow: "0 6px 28px rgba(28,38,40,0.05)",
              border: "1px solid rgba(28,38,40,0.03)",
            }}
          >
            <div
              style={{
                fontFamily: fonts.script,
                fontSize: "1.15rem",
                color: colors.brown,
                marginBottom: 10,
              }}
            >
              Prenotazione
            </div>
            <h2
              style={{
                fontFamily: fonts.primary,
                fontSize: "clamp(1.5rem, 3vw, 2rem)",
                fontWeight: 800,
                color: colors.dark,
                margin: "0 0 6px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Reserva tu Mesa
            </h2>
            <Divider />
            <p
              style={{
                fontFamily: fonts.primary,
                fontSize: "0.95rem",
                fontWeight: 400,
                color: "rgba(28,38,40,0.45)",
                lineHeight: 1.7,
                margin: "14px 0 26px",
              }}
            >
              Asegura tu lugar para una velada inolvidable.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginBottom: 22,
              }}
            >
              {["Nombre completo", "Fecha y hora", "Número de personas"].map(
                (ph) => (
                  <input
                    key={ph}
                    placeholder={ph}
                    style={{
                      fontFamily: fonts.primary,
                      fontSize: "0.95rem",
                      fontWeight: 400,
                      padding: "13px 16px",
                      border: "1.5px solid rgba(28,38,40,0.1)",
                      background: colors.cream,
                      color: colors.dark,
                      outline: "none",
                      transition: "border-color 0.3s",
                    }}
                    onFocus={(e) =>
                      (e.target.style.borderColor = colors.peru)
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "rgba(28,38,40,0.1)")
                    }
                  />
                )
              )}
            </div>
            <Button style={{ width: "100%" }}>Confirmar Reservación</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
