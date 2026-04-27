"use client";
import Link from "next/link";

export default function PagoFallidoPage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 20px",
      background: "#0a1112",
      color: "#f5f1e8",
      fontFamily: "inherit",
      textAlign: "center",
    }}>
      <div style={{
        maxWidth: 480,
        width: "100%",
        background: "#161e20",
        border: "1px solid rgba(200,80,80,0.4)",
        borderRadius: 16,
        padding: "40px 28px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
      }}>
        <div style={{ fontSize: "3.5rem", color: "#c85050", marginBottom: 14 }}>✕</div>
        <h1 style={{
          fontSize: "1.4rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "#c85050",
          marginBottom: 12,
        }}>
          Pago no completado
        </h1>
        <p style={{ color: "rgba(245,241,232,0.7)", marginBottom: 24, lineHeight: 1.5 }}>
          No pudimos procesar tu pago. Tu reserva no ha sido confirmada y la mesa
          quedará disponible. Inténtalo de nuevo cuando gustes.
        </p>
        <Link
          href="/reservation"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "#ba843c",
            color: "#0a1112",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize: "0.85rem",
          }}
        >
          Intentar de nuevo
        </Link>
      </div>
    </div>
  );
}
