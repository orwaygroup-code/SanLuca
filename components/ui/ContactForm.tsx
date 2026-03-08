"use client";

import { useState, type FormEvent } from "react";
import type { Location } from "@/types";

type Props = {
  locations: Location[];
};

type FormState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};

export function ContactForm({ locations }: Props) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    locationId: "",
    message: "",
  });
  const [state, setState] = useState<FormState>({ status: "idle", message: "" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState({ status: "loading", message: "" });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setState({
          status: "error",
          message: data.error || "Error al enviar el mensaje",
        });
        return;
      }

      setState({
        status: "success",
        message: "Mensaje enviado correctamente. Te contactaremos pronto.",
      });
      setForm({ name: "", email: "", locationId: "", message: "" });
    } catch {
      setState({
        status: "error",
        message: "Error de conexión. Intenta de nuevo.",
      });
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "0.625rem",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "0.9rem",
    boxSizing: "border-box" as const,
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <label htmlFor="name" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
          Nombre *
        </label>
        <input
          id="name"
          type="text"
          required
          minLength={2}
          maxLength={100}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="email" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
          Email *
        </label>
        <input
          id="email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="locationId" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
          Sucursal *
        </label>
        <select
          id="locationId"
          required
          value={form.locationId}
          onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
          style={inputStyle}
        >
          <option value="">Selecciona una sucursal</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="message" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>
          Mensaje *
        </label>
        <textarea
          id="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          style={inputStyle}
        />
      </div>

      <button
        type="submit"
        disabled={state.status === "loading"}
        style={{
          padding: "0.75rem 1.5rem",
          border: "1px solid #111",
          borderRadius: "4px",
          backgroundColor: "#111",
          color: "#fff",
          fontSize: "0.9rem",
          cursor: state.status === "loading" ? "not-allowed" : "pointer",
          opacity: state.status === "loading" ? 0.6 : 1,
        }}
      >
        {state.status === "loading" ? "Enviando..." : "Enviar Mensaje"}
      </button>

      {state.message && (
        <p
          style={{
            padding: "0.75rem",
            borderRadius: "4px",
            fontSize: "0.875rem",
            backgroundColor: state.status === "success" ? "#f0f9f0" : "#fdf0f0",
            color: state.status === "success" ? "#166534" : "#991b1b",
          }}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
