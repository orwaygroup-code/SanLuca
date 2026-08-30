"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { GoldSelect } from "@/components/ui/GoldSelect";
import type { SelectOption } from "@/components/ui/GoldSelect";
import { dialogConfirm } from "@/components/ui/DialogHost";

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const MONTH_OPTIONS: SelectOption[] = MONTHS_ES.map((m, i) => ({ value: String(i + 1), label: m }));
const MONTH_OPTIONS_SHORT: SelectOption[] = MONTHS_ES.map((m, i) => ({ value: String(i + 1), label: m.slice(0, 3) }));
const dayOptionsFor = (count: number): SelectOption[] =>
  Array.from({ length: count }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

interface SpecialDate {
  id: string;
  month: number;
  day: number;
  label: string;
  amount: number;
  isActive: boolean;
}

export default function FechasEspecialesPage() {
  const [items, setItems] = useState<SpecialDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ month: 1, day: 1, label: "", amount: 500 });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ label: string; amount: number; month: number; day: number } | null>(null);

  function authHeaders() {
    return { "Content-Type": "application/json" };
  }
  const fetchOpts = { credentials: "same-origin" as const };

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/special-dates", { ...fetchOpts });
      const d = await r.json();
      if (d.success) setItems(d.data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.label.trim()) { setError("Ingresa un nombre para la fecha"); return; }
    setCreating(true);
    try {
      const r = await fetch("/api/admin/special-dates", {
        method: "POST",
        ...fetchOpts,
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!d.success) { setError(d.error); return; }
      setForm({ month: 1, day: 1, label: "", amount: 500 });
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(item: SpecialDate) {
    await fetch(`/api/admin/special-dates/${item.id}`, {
      method: "PATCH",
      ...fetchOpts,
      headers: authHeaders(),
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    load();
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;
    await fetch(`/api/admin/special-dates/${id}`, {
      method: "PATCH",
      ...fetchOpts,
      headers: authHeaders(),
      body: JSON.stringify(editDraft),
    });
    setEditId(null);
    setEditDraft(null);
    load();
  }

  async function remove(id: string) {
    if (!(await dialogConfirm("¿Eliminar esta fecha especial?", { danger: true, confirmLabel: "Eliminar" }))) return;
    await fetch(`/api/admin/special-dates/${id}`, {
      method: "DELETE",
      ...fetchOpts,
    });
    load();
  }

  const daysInMonth = new Date(2024, form.month, 0).getDate();

  return (
    <div style={{ minHeight: "100vh", background: "var(--sl-bg)", color: "#f5f1e8", padding: "32px 20px", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <Link href="/admin" style={{ color: "rgba(186,132,60,0.8)", fontSize: "0.75rem", textDecoration: "none", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              ← Panel admin
            </Link>
            <h1 style={{ margin: "6px 0 0", fontSize: "1.6rem", letterSpacing: "0.05em" }}>Fechas Especiales</h1>
            <p style={{ margin: "4px 0 0", color: "rgba(245,241,232,0.55)", fontSize: "0.82rem" }}>
              Días con cobro anticipado por reserva. Las fechas se aplican cada año.
            </p>
          </div>
        </div>

        {/* Crear */}
        <form onSubmit={handleCreate} className="adm-special-form" style={{
          background: "var(--sl-panel)",
          border: "1px solid rgba(186,132,60,0.25)",
          borderRadius: 12,
          padding: "20px",
          marginBottom: 24,
        }}>
          <div>
            <label style={labelStyle}>Nombre</label>
            <input
              style={inputStyle}
              placeholder="Ej. Día del Padre"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>Mes</label>
            <GoldSelect
              value={String(form.month)}
              onChange={(v) => { const month = parseInt(v); setForm({ ...form, month, day: Math.min(form.day, new Date(2024, month, 0).getDate()) }); }}
              options={MONTH_OPTIONS}
            />
          </div>
          <div>
            <label style={labelStyle}>Día</label>
            <GoldSelect
              value={String(form.day)}
              onChange={(v) => setForm({ ...form, day: parseInt(v) })}
              options={dayOptionsFor(daysInMonth)}
            />
          </div>
          <div>
            <label style={labelStyle}>Monto MXN</label>
            <input
              type="number"
              min={0}
              style={inputStyle}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <button type="submit" disabled={creating} style={{
            padding: "10px 20px",
            background: "#ba843c",
            color: "#0a1112",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontSize: "0.78rem",
            whiteSpace: "nowrap",
          }}>
            {creating ? "Agregando..." : "Agregar"}
          </button>
          {error && (
            <div style={{ gridColumn: "1 / -1", color: "#c85050", fontSize: "0.8rem" }}>⚠ {error}</div>
          )}
        </form>

        {/* Lista */}
        {loading ? (
          <div style={{ color: "rgba(245,241,232,0.5)", textAlign: "center", padding: "40px 0" }}>Cargando…</div>
        ) : items.length === 0 ? (
          <div style={{ color: "rgba(245,241,232,0.5)", textAlign: "center", padding: "40px 0" }}>No hay fechas especiales registradas.</div>
        ) : (
          <div className="crm-table-wrap" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((it) => {
              const isEditing = editId === it.id;
              return (
                <div key={it.id} className="adm-special-row" style={{
                  background: "var(--sl-panel)",
                  border: `1px solid ${it.isActive ? "rgba(186,132,60,0.3)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  opacity: it.isActive ? 1 : 0.55,
                }}>
                  <div style={{
                    fontSize: "0.75rem",
                    color: "#ba843c",
                    fontWeight: 700,
                    background: "rgba(186,132,60,0.12)",
                    padding: "6px 10px",
                    borderRadius: 6,
                    minWidth: 92,
                    textAlign: "center",
                  }}>
                    {isEditing ? (
                      <span style={{ display: "flex", gap: 4 }}>
                        <GoldSelect
                          value={String(editDraft?.day ?? "")}
                          onChange={(v) => setEditDraft({ ...editDraft!, day: parseInt(v) })}
                          options={dayOptionsFor(new Date(2024, editDraft!.month, 0).getDate())}
                          style={{ minWidth: 62 }}
                        />
                        <GoldSelect
                          value={String(editDraft?.month ?? "")}
                          onChange={(v) => setEditDraft({ ...editDraft!, month: parseInt(v) })}
                          options={MONTH_OPTIONS_SHORT}
                          style={{ minWidth: 78 }}
                        />
                      </span>
                    ) : (
                      `${it.day} ${MONTHS_ES[it.month - 1].slice(0, 3)}`
                    )}
                  </div>
                  <div>
                    {isEditing ? (
                      <input
                        value={editDraft?.label}
                        onChange={(e) => setEditDraft({ ...editDraft!, label: e.target.value })}
                        style={{ ...inputStyle, padding: "6px 10px" }}
                      />
                    ) : (
                      <div style={{ fontWeight: 600 }}>{it.label}</div>
                    )}
                  </div>
                  <div>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editDraft?.amount}
                        onChange={(e) => setEditDraft({ ...editDraft!, amount: parseFloat(e.target.value) || 0 })}
                        style={{ ...inputStyle, padding: "6px 10px", width: 90 }}
                      />
                    ) : (
                      <div style={{ color: "#ba843c", fontWeight: 700 }}>${it.amount.toFixed(0)} MXN</div>
                    )}
                  </div>
                  <button onClick={() => toggleActive(it)} style={pillBtn(it.isActive)}>
                    {it.isActive ? "Activa" : "Inactiva"}
                  </button>
                  <div style={{ display: "flex", gap: 6 }}>
                    {isEditing ? (
                      <>
                        <button onClick={() => saveEdit(it.id)} style={iconBtn("#5fa15f")}>Guardar</button>
                        <button onClick={() => { setEditId(null); setEditDraft(null); }} style={iconBtn("#888")}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditId(it.id); setEditDraft({ label: it.label, amount: it.amount, month: it.month, day: it.day }); }} style={iconBtn("#ba843c")}>Editar</button>
                        <button onClick={() => remove(it.id)} style={iconBtn("#c85050")}>Eliminar</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.62rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "rgba(186,132,60,0.75)",
  marginBottom: 6,
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(186,132,60,0.06)",
  border: "1px solid rgba(186,132,60,0.3)",
  borderRadius: 8,
  color: "#f5f1e8",
  padding: "10px 12px",
  fontSize: "0.85rem",
  fontFamily: "inherit",
  outline: "none",
};

function pillBtn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 999,
    border: `1px solid ${active ? "#5fa15f" : "rgba(255,255,255,0.2)"}`,
    background: active ? "rgba(95,161,95,0.15)" : "transparent",
    color: active ? "#5fa15f" : "rgba(245,241,232,0.5)",
    fontSize: "0.7rem",
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  };
}

function iconBtn(color: string): React.CSSProperties {
  return {
    padding: "6px 12px",
    background: "transparent",
    border: `1px solid ${color}`,
    color,
    borderRadius: 6,
    fontSize: "0.7rem",
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "0.04em",
  };
}
