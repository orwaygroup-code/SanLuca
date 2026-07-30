"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useStaffSession } from "@/lib/staff-session-client";

const ROLE_HOME: Record<string, string> = {
  MANAGER:   "/staff/capitan",   // manager vía PIN = vista supervisora sl_staff (Ricardo usa /admin con sl_session)
  OPERATION: "/staff/operacion",
  CAPTAIN:   "/staff/capitan",
  WAITER:    "/staff/comandas",
};

const ERROR_MSG: Record<string, string> = {
  WRONG_CREDENTIALS: "Usuario o PIN incorrecto.",
  INACTIVE:          "Tu cuenta está desactivada. Avisa al manager.",
};

function StaffLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { staff, loading: sessionLoading } = useStaffSession();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  // Navegación post-login. /admin y /crm viven en el realm `sl_session`, cuyo
  // contexto (SessionProvider) SOLO se hidrata al montar la app y NO se refresca
  // en navegaciones de cliente. Tras el PIN, la cookie sl_session recién se puso;
  // un router.replace dejaría al panel sin verla → rebota al login → el login ve
  // sesión de staff y reenvía al panel → loop de redirects (parpadeo blanco).
  // Solución: a esas rutas vamos con navegación DURA (recarga → lee la sesión
  // fresca). Las rutas /staff/* usan useStaffSession (hook por-componente que se
  // re-hidrata al montar) → router.replace basta.
  const goHome = useCallback((dest: string) => {
    if (dest.startsWith("/admin") || dest.startsWith("/crm")) window.location.assign(dest);
    else router.replace(dest);
  }, [router]);

  // Ya con sesión (ej. al abrir el PWA anclado en /staff/login): enruta por rol
  // sin pedir PIN de nuevo. Respeta `next` si viene de un guard de página.
  useEffect(() => {
    if (sessionLoading || !staff) return;
    const next = params.get("next");
    const roleHome = ROLE_HOME[staff.role] || "/staff/comandas";
    // Si el destino es el panel (/admin o /crm) SOLO lo honramos si de verdad hay
    // sesión de admin (sl_session). Un staff sin acceso de admin (Perla, meseros)
    // en un dispositivo que apunta a /admin, en vez de loopear, va a su vista
    // normal. Rompe el ciclo AdminShell↔/staff/login para no-admins.
    if (next && (next.startsWith("/admin") || next.startsWith("/crm"))) {
      fetch("/api/auth/me", { credentials: "same-origin" })
        .then((r) => r.json())
        .catch(() => null)
        .then((d) => {
          const isAdmin = d?.authenticated && (d.user?.role === "ADMIN" || d.user?.role === "HOSTES");
          goHome(isAdmin ? next : roleHome);
        });
      return;
    }
    goHome(next || roleHome);
  }, [sessionLoading, staff, params, goHome]);

  const submit = useCallback(async () => {
    if (loading) return;
    if (!/^\d{4}$/.test(pin)) { setError("El PIN debe ser de 4 dígitos."); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/staff/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), pin }),
      });
      const data = await r.json().catch(() => null);
      if (!data?.success) {
        setError(ERROR_MSG[data?.error] ?? data?.error ?? "Error al iniciar sesión.");
        setPin("");
        pinRef.current?.focus();
        return;
      }
      const next = params.get("next");
      // Admin ligado (Ricardo/Francesca) → directo al panel; el resto por rol.
      const home = next || (data.data.hasAdmin ? "/admin" : ROLE_HOME[data.data.role]) || "/staff/login";
      goHome(home);
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [loading, pin, username, params, goHome]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>SAN LUCA</div>
        <h1 style={styles.title}>Acceso de personal</h1>
        <p style={styles.subtitle}>Ingresa tu usuario y PIN de 4 dígitos.</p>

        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 22 }}
        >
          <div>
            <label style={styles.label}>Usuario</label>
            <input
              style={styles.input}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ej. ricardo"
            />
          </div>
          <div>
            <label style={styles.label}>PIN</label>
            <input
              ref={pinRef}
              style={{ ...styles.input, letterSpacing: "0.5em", textAlign: "center", fontSize: "1.4rem" }}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
            />
          </div>

          {error && <p style={styles.error}>⚠ {error}</p>}

          <button
            type="submit"
            disabled={loading || !username.trim() || pin.length !== 4}
            style={{
              ...styles.button,
              opacity: loading || !username.trim() || pin.length !== 4 ? 0.5 : 1,
              cursor: loading || !username.trim() || pin.length !== 4 ? "default" : "pointer",
            }}
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div style={{ marginTop: 18, textAlign: "center" }}>
          <a href="/login" style={{ color: "rgba(245,241,232,0.5)", fontSize: "0.76rem", textDecoration: "none" }}>
            ¿Administras por correo? Entra aquí
          </a>
        </div>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  // useSearchParams requiere Suspense boundary en App Router (build standalone).
  return (
    <Suspense fallback={null}>
      <StaffLoginInner />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#16201f", padding: 20,
  },
  card: {
    width: "100%", maxWidth: 380, background: "#1a2628",
    border: "1px solid rgba(186,132,60,0.25)", borderRadius: 18,
    padding: "34px 30px", boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
  },
  brand: { fontSize: "0.7rem", letterSpacing: "0.4em", color: "#ba843c", fontWeight: 800, textAlign: "center" },
  title: { margin: "14px 0 0", fontSize: "1.25rem", color: "#f5f1e8", fontWeight: 700, textAlign: "center" },
  subtitle: { margin: "6px 0 0", fontSize: "0.82rem", color: "rgba(245,241,232,0.68)", textAlign: "center" },
  label: {
    display: "block", fontSize: "0.64rem", letterSpacing: "0.16em", textTransform: "uppercase",
    color: "rgba(245,241,232,0.62)", fontWeight: 700, marginBottom: 6,
  },
  input: {
    width: "100%", padding: "12px 14px", minHeight: 48, borderRadius: 10, boxSizing: "border-box",
    border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)",
    color: "#f5f1e8", fontSize: "0.95rem", fontFamily: "inherit",
  },
  error: { margin: 0, color: "#e8766b", fontSize: "0.84rem", fontWeight: 600 },
  button: {
    padding: "14px 0", minHeight: 48, borderRadius: 10, border: "none", background: "#ba843c",
    color: "#16201f", fontWeight: 800, fontSize: "0.9rem", letterSpacing: "0.05em",
    textTransform: "uppercase", fontFamily: "inherit",
  },
};
