"use client";

import type { MetaTemplate } from "@/types/marketing";
import { renderTemplateBody } from "@/lib/marketing-mock";

/**
 * Preview del template como burbuja de WhatsApp, con header (imagen),
 * cuerpo con variables sustituidas y botones. Lo que ve el cliente.
 */
export function WhatsAppPreview({
  template,
  params,
  headerImageUrl,
}: {
  template: MetaTemplate;
  params: Record<string, string>;
  headerImageUrl?: string | null;
}) {
  const body = renderTemplateBody(template, params);
  const imgSrc = headerImageUrl || template.headerExample || null;
  const showHeader = template.headerType === "IMAGE" && imgSrc;

  return (
    <div style={phoneFrame}>
      {/* Status bar simulada */}
      <div style={phoneStatus}>
        <span>San Luca</span>
        <span style={{ opacity: 0.6 }}>en línea</span>
      </div>

      {/* Área de mensajes con wallpaper */}
      <div style={chatArea}>
        <div style={bubble}>
          {showHeader && (
            <div style={bubbleHeader}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt="Header"
                style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}

          <div style={bubbleBody}>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.84rem", lineHeight: 1.45 }}>
              {body}
            </p>
            <div style={bubbleTime}>
              {new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>

          {template.buttons && template.buttons.length > 0 && (
            <div style={buttonsRow}>
              {template.buttons.map((b, i) => (
                <button key={i} style={btnStyle} disabled type="button">
                  {b.type === "URL" && <span style={{ fontSize: "0.7rem", marginRight: 4 }}>↗</span>}
                  {b.text}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const phoneFrame: React.CSSProperties = {
  width: "100%",
  maxWidth: 320,
  background: "#0c1818",
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.08)",
  overflow: "hidden",
  boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
};

const phoneStatus: React.CSSProperties = {
  background: "#075e54",
  color: "#f5f1e8",
  padding: "10px 16px",
  fontSize: "0.78rem",
  fontWeight: 600,
  display: "flex",
  justifyContent: "space-between",
};

const chatArea: React.CSSProperties = {
  background:
    "linear-gradient(180deg, #0f1b1a 0%, #0a1413 100%)",
  padding: 16,
  minHeight: 280,
  display: "flex",
  alignItems: "flex-end",
};

const bubble: React.CSSProperties = {
  background: "#1f2c2a",
  border: "1px solid rgba(255,255,255,0.04)",
  borderRadius: 12,
  borderTopLeftRadius: 4,
  overflow: "hidden",
  width: "100%",
  maxWidth: 260,
};

const bubbleHeader: React.CSSProperties = {
  background: "#000",
};

const bubbleBody: React.CSSProperties = {
  padding: "10px 12px 6px",
  color: "#f5f1e8",
};

const bubbleTime: React.CSSProperties = {
  fontSize: "0.65rem",
  color: "rgba(245,241,232,0.45)",
  textAlign: "right",
  marginTop: 4,
};

const buttonsRow: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  borderTop: "1px solid rgba(255,255,255,0.06)",
};

const btnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  padding: "10px 12px",
  color: "#4a9eca",
  fontFamily: "inherit",
  fontSize: "0.82rem",
  fontWeight: 500,
  cursor: "default",
  textAlign: "center",
};
