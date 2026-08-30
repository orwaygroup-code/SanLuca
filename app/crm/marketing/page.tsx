"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CrmPageHead } from "@/components/crm/CrmPageHead";
import { fetchCampaigns, statusBadgeColor, statusLabel } from "@/lib/marketing-mock";
import type { MarketingCampaign } from "@/types/marketing";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtRelative(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "ahora";
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`;
  return fmtDate(iso);
}

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCampaigns().then((list) => { if (alive) setCampaigns(list); });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <CrmPageHead accent="MARKETING" title="CAMPAÑAS" sub="Envíos masivos por tag · WhatsApp Business" />

      <div style={topBar}>
        <div style={{ display: "flex", gap: 18 }}>
          <Stat label="Total" value={campaigns?.length ?? "—"} />
          <Stat label="Borrador"    value={campaigns?.filter((c) => c.status === "DRAFT").length ?? "—"} />
          <Stat label="Programadas" value={campaigns?.filter((c) => c.status === "SCHEDULED").length ?? "—"} />
          <Stat label="En envío"    value={campaigns?.filter((c) => c.status === "SENDING").length ?? "—"} />
          <Stat label="Completas"   value={campaigns?.filter((c) => c.status === "COMPLETED").length ?? "—"} />
        </div>
        <Link href="/crm/marketing/nueva" style={primaryBtn}>
          + Nueva campaña
        </Link>
      </div>

      {campaigns === null ? (
        <p style={muted}>Cargando…</p>
      ) : campaigns.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Nombre</th>
                <th style={th}>Estado</th>
                <th style={th}>Template</th>
                <th style={th}>Destinatarios</th>
                <th style={th}>Progreso</th>
                <th style={th}>Creada</th>
                <th style={{ ...th, textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const sb = statusBadgeColor(c.status);
                const pct =
                  c.totalTargets > 0
                    ? Math.round((c.sentCount / c.totalTargets) * 100)
                    : 0;
                return (
                  <tr key={c.id} style={tr}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: "var(--sl-cream)" }}>{c.name}</div>
                      <div style={tdSub}>{c.filters.tagIds.length} tag{c.filters.tagIds.length !== 1 ? "s" : ""} · modo {c.filters.mode}</div>
                    </td>
                    <td style={td}>
                      <span style={{
                        ...badge,
                        background: sb.bg,
                        border:     `1px solid ${sb.border}`,
                        color:      sb.text,
                      }}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td style={td}>
                      <code style={codeStyle}>{c.templateName}</code>
                    </td>
                    <td style={td}>
                      {c.totalTargets > 0 ? c.totalTargets : "—"}
                    </td>
                    <td style={td}>
                      {c.totalTargets > 0 ? (
                        <div>
                          <div style={{ fontSize: "0.78rem", color: "rgb(var(--sl-cream-rgb) / 0.7)" }}>
                            {c.sentCount} / {c.totalTargets} ({pct}%)
                          </div>
                          <div style={progressBar}>
                            <div style={{ ...progressFill, width: `${pct}%` }} />
                          </div>
                          {c.failedCount > 0 && (
                            <div style={{ color: "#e05555", fontSize: "0.7rem", marginTop: 2 }}>
                              {c.failedCount} con error
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={tdSub}>Sin envíos aún</span>
                      )}
                    </td>
                    <td style={td}>
                      <div style={{ fontSize: "0.78rem" }}>{fmtRelative(c.createdAt)}</div>
                      {c.scheduledAt && (
                        <div style={tdSub}>Para {fmtDate(c.scheduledAt)}</div>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button style={secondaryBtn} disabled type="button">
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={hintFooter}>
        ⓘ Backend en construcción. La lista usa <code>localStorage</code> como mock —
        las campañas aún no envían mensajes reales hasta que el endpoint POST <code>/send</code> esté conectado.
      </p>
    </>
  );
}

function EmptyState() {
  return (
    <div style={emptyWrap}>
      <div style={{ fontSize: "2.4rem", marginBottom: 12 }}>📣</div>
      <h3 style={{ margin: "0 0 6px", color: "var(--sl-cream)", fontWeight: 600 }}>
        Ninguna campaña aún
      </h3>
      <p style={{ margin: "0 0 18px", color: "rgb(var(--sl-cream-rgb) / 0.55)", maxWidth: 380, fontSize: "0.86rem", lineHeight: 1.5 }}>
        Crea tu primera campaña seleccionando un template aprobado por Meta,
        ajustando las variables y eligiendo los tags de los clientes que la recibirán.
      </p>
      <Link href="/crm/marketing/nueva" style={primaryBtn}>
        + Crear primera campaña
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={statBox}>
      <span style={{ color: "rgb(var(--sl-cream-rgb) / 0.5)", fontSize: "0.66rem", letterSpacing: "0.18em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: "var(--sl-cream)", fontSize: "1.15rem", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ── Estilos ─────────────────────────────────────────────────────────────

const topBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 14,
  marginBottom: 22,
};

const statBox: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "8px 14px",
  background: "rgb(var(--sl-veil-rgb) / 0.03)",
  borderRadius: 10,
  border: "1px solid rgb(var(--sl-veil-rgb) / 0.05)",
  minWidth: 76,
};

const primaryBtn: React.CSSProperties = {
  background: "var(--sl-gold)",
  color: "#1c2628",
  padding: "10px 20px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: "0.82rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  textDecoration: "none",
  fontFamily: "inherit",
  border: "none",
  cursor: "pointer",
  display: "inline-block",
};

const secondaryBtn: React.CSSProperties = {
  background: "transparent",
  color: "rgb(var(--sl-cream-rgb) / 0.55)",
  border: "1px solid rgb(var(--sl-cream-rgb) / 0.18)",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: "0.74rem",
  fontFamily: "inherit",
  fontWeight: 600,
  cursor: "not-allowed",
};

const muted: React.CSSProperties = {
  color: "rgb(var(--sl-cream-rgb) / 0.5)",
  fontSize: "0.85rem",
};

const emptyWrap: React.CSSProperties = {
  background: "var(--sl-panel2)",
  border: "1px solid rgb(var(--sl-veil-rgb) / 0.05)",
  borderRadius: 16,
  padding: "60px 24px",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const tableWrap: React.CSSProperties = {
  background: "var(--sl-panel2)",
  border: "1px solid rgb(var(--sl-veil-rgb) / 0.05)",
  borderRadius: 14,
  overflow: "hidden",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.85rem",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  background: "rgb(var(--sl-veil-rgb) / 0.02)",
  borderBottom: "1px solid rgb(var(--sl-veil-rgb) / 0.06)",
  color: "rgb(var(--sl-cream-rgb) / 0.55)",
  fontWeight: 600,
  fontSize: "0.72rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const tr: React.CSSProperties = {
  borderBottom: "1px solid rgb(var(--sl-veil-rgb) / 0.04)",
};

const td: React.CSSProperties = {
  padding: "14px 16px",
  verticalAlign: "top",
  color: "rgb(var(--sl-cream-rgb) / 0.85)",
};

const tdSub: React.CSSProperties = {
  fontSize: "0.72rem",
  color: "rgb(var(--sl-cream-rgb) / 0.4)",
  marginTop: 2,
};

const codeStyle: React.CSSProperties = {
  background: "rgb(var(--sl-gold-rgb) / 0.10)",
  color: "var(--sl-gold)",
  padding: "2px 8px",
  borderRadius: 6,
  fontFamily: "monospace",
  fontSize: "0.78rem",
};

const badge: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 10px",
  borderRadius: 999,
  fontSize: "0.7rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const progressBar: React.CSSProperties = {
  marginTop: 4,
  width: 120,
  height: 5,
  background: "rgb(var(--sl-veil-rgb) / 0.06)",
  borderRadius: 3,
  overflow: "hidden",
};

const progressFill: React.CSSProperties = {
  height: "100%",
  background: "var(--sl-gold)",
  transition: "width 0.3s",
};

const hintFooter: React.CSSProperties = {
  marginTop: 22,
  color: "rgb(var(--sl-cream-rgb) / 0.4)",
  fontSize: "0.78rem",
  lineHeight: 1.55,
};
