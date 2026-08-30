"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/components/staff/types";
import { dialogAlert, dialogPrompt } from "@/components/ui/DialogHost";

/**
 * Créditos de meseros: cuentas que un mesero pagó a crédito (se descuentan de su
 * nómina). Agrupadas por mesero; se marcan pagadas al descontarlas. Vive bajo /admin
 * (lo envuelve AdminShell → guard ADMIN + menú lateral).
 */
interface Credit {
  id: number;
  amount: number | string;
  status: string;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
  waiter: { id: number; fullName: string };
  comanda: { folio: string } | null;
  authorizedBy: { fullName: string } | null;
}

const fmt = (n: number | string) => "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CreditosPage() {
  const [credits, setCredits] = useState<Credit[] | null>(null);
  const [filter, setFilter] = useState<"OUTSTANDING" | "PAID" | "ALL">("OUTSTANDING");
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    const q = filter === "ALL" ? "" : `?status=${filter}`;
    apiFetch<Credit[]>(`/api/admin/waiter-credits${q}`).then((r) => setCredits(r.ok ? (r.data ?? []) : []));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: number, status: "PAID" | "OUTSTANDING") => {
    const pin = await dialogPrompt(
      status === "PAID" ? "PIN de Manager para marcar este crédito como pagado (se descuenta de nómina)." : "PIN de Manager para reabrir este crédito.",
      { title: status === "PAID" ? "Marcar pagada" : "Reabrir crédito", password: true, maxLength: 4, placeholder: "PIN", confirmLabel: status === "PAID" ? "Marcar pagada" : "Reabrir" },
    );
    if (!pin || pin.length !== 4) return;
    setBusy(id);
    const r = await apiFetch(`/api/admin/waiter-credits/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, authPin: pin }),
    });
    setBusy(null);
    if (r.ok) load();
    else await dialogAlert(r.error ?? "No se pudo actualizar el crédito");
  };

  const byWaiter = new Map<number, { name: string; items: Credit[]; owed: number }>();
  for (const c of credits ?? []) {
    const g = byWaiter.get(c.waiter.id) ?? { name: c.waiter.fullName, items: [], owed: 0 };
    g.items.push(c);
    if (c.status === "OUTSTANDING") g.owed += Number(c.amount);
    byWaiter.set(c.waiter.id, g);
  }
  const groups = [...byWaiter.values()].sort((a, b) => b.owed - a.owed);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", color: "#e8e6e0" }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 4px" }}>Créditos de meseros</h1>
      <p style={{ opacity: 0.6, fontSize: "0.85rem", margin: "0 0 16px" }}>
        Cuentas que los meseros pagaron a crédito. Márcalas como pagadas al descontarlas de nómina.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["OUTSTANDING", "PAID", "ALL"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 700,
              border: "1px solid " + (filter === f ? "var(--sl-gold)" : "rgb(var(--sl-veil-rgb) / 0.15)"),
              background: filter === f ? "rgb(var(--sl-gold-rgb) / 0.16)" : "transparent",
              color: filter === f ? "#d8a13a" : "#bbb",
            }}
          >{f === "OUTSTANDING" ? "Por cobrar" : f === "PAID" ? "Pagadas" : "Todas"}</button>
        ))}
      </div>

      {credits === null ? (
        <p style={{ opacity: 0.6 }}>Cargando…</p>
      ) : groups.length === 0 ? (
        <p style={{ opacity: 0.6 }}>Sin créditos {filter === "OUTSTANDING" ? "por cobrar" : filter === "PAID" ? "pagados" : ""}.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groups.map((g) => (
            <div key={g.name} style={{ border: "1px solid rgb(var(--sl-veil-rgb) / 0.1)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "rgb(var(--sl-veil-rgb) / 0.03)", fontWeight: 800 }}>
                <span>{g.name}</span>
                {g.owed > 0 && <span style={{ color: "#d9534f" }}>Debe {fmt(g.owed)}</span>}
              </div>
              {g.items.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: "1px solid rgb(var(--sl-veil-rgb) / 0.06)", opacity: c.status === "PAID" ? 0.55 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{fmt(c.amount)}{c.comanda ? ` · ${c.comanda.folio}` : ""}</div>
                    <div style={{ fontSize: "0.76rem", opacity: 0.6 }}>
                      {new Date(c.createdAt).toLocaleString("es-MX")}
                      {c.authorizedBy ? ` · autorizó ${c.authorizedBy.fullName}` : ""}
                      {c.status === "PAID" && c.paidAt ? ` · pagado ${new Date(c.paidAt).toLocaleDateString("es-MX")}` : ""}
                    </div>
                  </div>
                  {c.status === "OUTSTANDING" ? (
                    <button onClick={() => setStatus(c.id, "PAID")} disabled={busy === c.id}
                      style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "#3f9d6f", color: "#0f1a15", fontWeight: 800, cursor: "pointer" }}>
                      Marcar pagada
                    </button>
                  ) : (
                    <button onClick={() => setStatus(c.id, "OUTSTANDING")} disabled={busy === c.id}
                      style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgb(var(--sl-veil-rgb) / 0.15)", background: "transparent", color: "#bbb", cursor: "pointer" }}>
                      Reabrir
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
