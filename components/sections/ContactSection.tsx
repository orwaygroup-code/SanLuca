"use client";

import { useState } from "react";
import { colors, fonts } from "@/config/theme";
import Button from "@/components/ui/Button";
import { SectionHead, Divider } from "@/components/ui/SectionHead";


/* ─── Hours Data ─── */
const HOURS = [
  { day: "Lunes",           time: "Cerrado" },
  { day: "Martes – Jueves", time: "8:00 – 23:00" },
  { day: "Viernes – Sábado", time: "8:00 – 00:00" },
  { day: "Domingo",         time: "8:00 – 21:00" },
];

/* ─── Shared Input Style ─── */
const inputBase: React.CSSProperties = {
  fontFamily: fonts.primary,
  fontSize: "0.95rem",
  fontWeight: 400,
  padding: "14px 16px",
  width: "100%",
  border: "1.5px solid rgba(28,38,40,0.1)",
  background: colors.cream,
  color: colors.dark,
  outline: "none",
  transition: "border-color 0.3s",
};

/* ─── Field ─── */
function Field({
  label,
  name,
  type = "text",
  textarea = false,
  value,
  onChange,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  textarea?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.brown
    : focused
      ? colors.peru
      : "rgba(28,38,40,0.1)";
  const style = { ...inputBase, border: `1.5px solid ${borderColor}` };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontFamily: fonts.primary,
          fontSize: "0.72rem",
          fontWeight: 800,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dark,
          opacity: 0.6,
        }}
      >
        {label}
      </label>
      {textarea ? (
        <textarea
          name={name}
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ ...style, resize: "vertical" }}
        />
      ) : (
        <input
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={style}
        />
      )}
      {error && (
        <span
          style={{
            fontFamily: fonts.primary,
            fontSize: "0.78rem",
            color: colors.brown,
            fontWeight: 400,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

/* ─── Select ─── */
function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.brown
    : focused
      ? colors.peru
      : "rgba(28,38,40,0.1)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontFamily: fonts.primary,
          fontSize: "0.72rem",
          fontWeight: 800,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dark,
          opacity: 0.6,
        }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...inputBase,
          border: `1.5px solid ${borderColor}`,
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23ba843c' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 16px center",
          paddingRight: 44,
          cursor: "pointer",
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span
          style={{
            fontFamily: fonts.primary,
            fontSize: "0.78rem",
            color: colors.brown,
            fontWeight: 400,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

/* ─── Info Card ─── */
function InfoCard({
  icon,
  label,
  lines,
}: {
  icon: string;
  label: string;
  lines: string[];
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? "rgba(186,132,60,0.06)"
          : "rgba(245,241,232,0.03)",
        border: `1px solid ${hovered ? "rgba(186,132,60,0.15)" : "rgba(245,241,232,0.06)"}`,
        padding: "28px 24px",
        transition: "all 0.4s",
      }}
    >
      <div style={{ fontSize: "1.6rem", marginBottom: 10 }}>{icon}</div>
      <h4
        style={{
          fontFamily: fonts.primary,
          fontSize: "0.72rem",
          fontWeight: 800,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: colors.peru,
          marginBottom: 10,
        }}
      >
        {label}
      </h4>
      {lines.map((line) => (
        <p
          key={line}
          style={{
            fontFamily: fonts.primary,
            fontSize: "0.92rem",
            fontWeight: 400,
            color: "rgba(245,241,232,0.6)",
            margin: "0 0 3px",
            lineHeight: 1.6,
          }}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   CONTACT PAGE
   ═══════════════════════════════════════════ */
export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [apiError, setApiError] = useState("");

  /* ── Update helper ── */
  const update = (key: string) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    // Reset status when user edits after error/success
    if (status === "error" || status === "sent") {
      setStatus("idle");
      setApiError("");
    }
  };

  /* ── Client-side validation (mirrors Zod schema) ── */
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (form.name.length < 2) errs.name = "El nombre debe tener al menos 2 caracteres";
    if (form.name.length > 100) errs.name = "El nombre no puede exceder 100 caracteres";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Ingresa un email válido";
    if (form.message.length < 10) errs.message = "El mensaje debe tener al menos 10 caracteres";
    if (form.message.length > 2000) errs.message = "El mensaje no puede exceder 2000 caracteres";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Submit → POST /api/contact ── */
  const handleSubmit = async () => {
    setApiError("");
    if (!validate()) return;

    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          message: form.message,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setStatus("sent");
        setForm({ name: "", email: "", message: "" });
      } else {
        setStatus("error");
        setApiError(json.error || "Error al enviar el mensaje");
      }
    } catch {
      setStatus("error");
      setApiError("Error de conexión. Intenta de nuevo.");
    }
  };

  /* ═══ RENDER ═══ */
  return (
    <>
      {/* ── Hero Banner ── */}
      <section
        style={{
          background: `linear-gradient(170deg, ${colors.dark} 0%, #263234 50%, ${colors.dark} 100%)`,
          padding: "160px 24px 80px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute", inset: 0, opacity: 0.05, pointerEvents: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='t'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='6' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23t)'/%3E%3C/svg%3E")`,
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: fonts.script, fontSize: "1.3rem", color: colors.peru, marginBottom: 12, opacity: 0.8 }}>
            Contattaci
          </div>
          <h1
            style={{
              fontFamily: fonts.primary, fontSize: "clamp(2.2rem, 5vw, 3.6rem)",
              fontWeight: 800, color: colors.cream, letterSpacing: "0.1em",
              textTransform: "uppercase", margin: "0 0 16px", lineHeight: 1.05,
            }}
          >
            Contacto
          </h1>
          <Divider color="rgba(186,132,60,0.35)" />
          <p style={{
            fontFamily: fonts.primary, fontSize: "1.05rem", fontWeight: 400,
            color: "rgba(245,241,232,0.5)", maxWidth: 480, margin: "16px auto 0", lineHeight: 1.7,
          }}>
            Estamos para servirte. Contáctanos para reservaciones, eventos privados o cualquier consulta.
          </p>
        </div>
      </section>



      {/* ── Form + Hours ── */}
      <section style={{ background: colors.cream, padding: "clamp(64px, 10vw, 100px) 24px", position: "relative" }}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.025, pointerEvents: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='t'%3E%3CfeTurbulence baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23t)'/%3E%3C/svg%3E")`,
        }} />

        <div style={{
          maxWidth: 1000, margin: "0 auto", position: "relative",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 48, alignItems: "start",
        }}>
          {/* ── Form ── */}
          <div>
            <SectionHead script="Scrivici" title="Envíanos un Mensaje" />
            <div style={{
              display: "flex", flexDirection: "column", gap: 18,
              background: colors.white, padding: "clamp(28px, 4vw, 44px)",
              boxShadow: "0 6px 28px rgba(28,38,40,0.05)", border: "1px solid rgba(28,38,40,0.03)",
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18 }}>
                <Field label="Nombre" name="name" value={form.name} onChange={update("name")} error={errors.name} />
                <Field label="Correo electrónico" name="email" type="email" value={form.email} onChange={update("email")} error={errors.email} />
              </div>

              <Field label="Mensaje" name="message" textarea value={form.message} onChange={update("message")} error={errors.message} />

              {apiError && (
                <p style={{
                  fontFamily: fonts.primary, fontSize: "0.85rem", color: colors.brown,
                  background: "rgba(171,62,42,0.08)", padding: "10px 14px", margin: 0,
                }}>
                  {apiError}
                </p>
              )}

              <div style={{ marginTop: 8 }}>
                <Button onClick={handleSubmit} style={{ width: "100%" }}>
                  {status === "sending" ? "Enviando..." : status === "sent" ? "¡Mensaje Enviado!" : "Enviar Mensaje"}
                </Button>
              </div>

              {status === "sent" && (
                <p style={{ fontFamily: fonts.primary, fontSize: "0.9rem", color: colors.peru, textAlign: "center", margin: 0 }}>
                  Gracias por contactarnos. Te responderemos a la brevedad.
                </p>
              )}
            </div>
          </div>

          {/* ── Hours + Map ── */}
          <div>
            <SectionHead script="Orario" title="Horario" />
            <div style={{
              background: colors.dark, padding: "36px 32px", marginBottom: 24,
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='t'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='6'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23t)'/%3E%3C/svg%3E")`,
              }} />
              <div style={{ position: "relative" }}>
                {HOURS.map(({ day, time }) => (
                  <div key={day} style={{
                    display: "flex", justifyContent: "space-between",
                    fontFamily: fonts.primary, fontSize: "1rem", fontWeight: 400,
                    padding: "14px 0", borderBottom: "1px solid rgba(186,132,60,0.08)",
                  }}>
                    <span style={{ color: "rgba(245,241,232,0.5)" }}>{day}</span>
                    <span style={{ color: colors.cream, fontWeight: 800, letterSpacing: "0.04em" }}>{time}</span>
                  </div>
                ))}
                <p style={{
                  fontFamily: fonts.script, fontSize: "1rem", color: colors.peru,
                  textAlign: "center", marginTop: 20, marginBottom: 0,
                }}>
                  Ti aspettiamo!
                </p>
              </div>
            </div>

            {/* Map */}
            <div style={{
              background: colors.dark, height: 260, display: "flex", alignItems: "center",
              justifyContent: "center", flexDirection: "column", gap: 12,
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='t'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='6'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23t)'/%3E%3C/svg%3E")`,
              }} />
              <div style={{ position: "relative", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}></div>
                <p style={{
                  fontFamily: fonts.primary, fontSize: "0.8rem", fontWeight: 800,
                  letterSpacing: "0.18em", textTransform: "uppercase", color: colors.peru, margin: "0 0 6px",
                }}>
                  Encuéntranos
                </p>
                <p style={{ fontFamily: fonts.primary, fontSize: "0.9rem", fontWeight: 400, color: "rgba(245,241,232,0.45)", margin: 0 }}>
                  Aguascalientes, Ags.
                </p>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent("San Luca Ristorante Aguascalientes")}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "inline-block", marginTop: 16, fontFamily: fonts.primary,
                    fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.18em",
                    textTransform: "uppercase", color: colors.cream, background: colors.peru,
                    padding: "10px 24px", textDecoration: "none", transition: "background 0.3s",
                  }}
                >
                  Abrir en Google Maps
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}