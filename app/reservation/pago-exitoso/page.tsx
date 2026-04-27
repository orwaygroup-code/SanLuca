"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function PagoExitosoPage() {
  const params = useSearchParams();
  const reservationId = params.get("r") || "";
  const [status, setStatus] = useState<"checking" | "confirmed" | "pending">("checking");

  useEffect(() => {
    if (!reservationId) return;
    let cancelled = false;
    async function check() {
      try {
        const r = await fetch(`/api/reservations/status?id=${reservationId}`);
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        if (data?.status === "CONFIRMED") setStatus("confirmed");
        else setStatus("pending");
      } catch {
        if (!cancelled) setStatus("pending");
      }
    }
    check();
    const id = setInterval(check, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [reservationId]);

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
        border: "1px solid rgba(186,132,60,0.3)",
        borderRadius: 16,
        padding: "40px 28px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
      }}>
        <div style={{
          fontSize: "3.5rem",
          color: "#ba843c",
          marginBottom: 14,
        }}>
          {status === "confirmed" ? "✓" : "⏳"}
        </div>
        <h1 style={{
          fontSize: "1.4rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "#ba843c",
          marginBottom: 12,
        }}>
          {status === "confirmed" ? "Pago confirmado" : "Procesando pago"}
        </h1>
        <p style={{ color: "rgba(245,241,232,0.7)", marginBottom: 24, lineHeight: 1.5 }}>
          {status === "confirmed"
            ? "Tu reserva ha sido confirmada. Recibirás los detalles por WhatsApp."
            : "Estamos verificando tu pago con MercadoPago. Esto puede tardar unos segundos…"}
        </p>
        <Link
          href="/dashboard"
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
          Ver mis reservas
        </Link>
      </div>
    </div>
  );
}
