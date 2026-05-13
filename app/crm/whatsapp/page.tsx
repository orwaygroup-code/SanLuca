"use client";

import { useEffect, useState, useRef } from "react";
import { CrmPageHead } from "@/components/crm/CrmPageHead";

interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  messageType: string;
  sentAt: string;
}

interface ConvSummary {
  id: string;
  phone: string;
  userId: string | null;
  userName: string | null;
  lastMessage: { body: string; direction: "INBOUND" | "OUTBOUND"; sentAt: string } | null;
  messageCount: number;
  updatedAt: string;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "ahora";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", timeZone: "America/Mexico_City" });
}

export default function WhatsappPage() {
  const [convs, setConvs]       = useState<ConvSummary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread]     = useState<{ conv: ConvSummary; messages: Message[] } | null>(null);
  const [threadLoad, setTL]     = useState(false);
  const [search, setSearch]     = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/crm/whatsapp/conversations", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setConvs(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setTL(true);
    setThread(null);
    fetch(`/api/crm/whatsapp/conversations/${encodeURIComponent(selected)}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.conversation) {
          const c = convs.find((x) => x.phone === selected);
          setThread({ conv: c!, messages: d.conversation.messages });
        }
      })
      .finally(() => setTL(false));
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages]);

  const filtered = convs.filter((c) =>
    c.phone.includes(search) ||
    (c.userName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const displayName = (c: ConvSummary) => c.userName ?? c.phone;

  return (
    <>
      <CrmPageHead accent="WHATSAPP" title="CRM" sub="Inbox · conversaciones reales" />

      <div style={shell}>
        {/* ── Lista izquierda ── */}
        <div style={listCol}>
          <div style={{ padding: "12px 14px 8px" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número o nombre…"
              style={searchInput}
            />
          </div>

          {loading ? (
            <p style={muted}>Cargando…</p>
          ) : filtered.length === 0 ? (
            <p style={muted}>
              {convs.length === 0
                ? "Sin conversaciones aún. Cuando el bot registre mensajes aparecerán aquí."
                : "Sin resultados"}
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.phone}
                onClick={() => setSelected(c.phone)}
                style={{
                  ...convItem,
                  background: selected === c.phone ? "rgba(186,132,60,0.12)" : "transparent",
                  borderLeft: selected === c.phone ? "3px solid #ba843c" : "3px solid transparent",
                }}
              >
                <div style={convAvatar}>{displayName(c).charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={convName}>{displayName(c)}</span>
                    {c.lastMessage && (
                      <span style={convTime}>{timeAgo(c.lastMessage.sentAt)}</span>
                    )}
                  </div>
                  <div style={convPreview}>
                    {c.lastMessage
                      ? (c.lastMessage.direction === "OUTBOUND" ? "Luca: " : "") +
                        c.lastMessage.body.slice(0, 55) + (c.lastMessage.body.length > 55 ? "…" : "")
                      : "Sin mensajes"}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* ── Hilo derecha ── */}
        <div style={threadCol}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(245,241,232,0.3)", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: "2rem" }}>💬</span>
              <span style={{ fontSize: "0.85rem" }}>Selecciona una conversación</span>
            </div>
          ) : threadLoad ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(245,241,232,0.4)" }}>
              Cargando mensajes…
            </div>
          ) : thread ? (
            <>
              <div style={threadHeader}>
                <div style={convAvatar}>{displayName(thread.conv).charAt(0).toUpperCase()}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{displayName(thread.conv)}</div>
                  <div style={{ fontSize: "0.72rem", color: "rgba(245,241,232,0.5)" }}>
                    {thread.conv.phone}
                    {thread.conv.userName && thread.conv.userName !== thread.conv.phone && ` · ${thread.conv.phone}`}
                    {" "}· {thread.messages.length} mensaje{thread.messages.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              <div style={messagesArea}>
                {thread.messages.map((m, i) => {
                  const showDate =
                    i === 0 ||
                    fmtDate(m.sentAt) !== fmtDate(thread.messages[i - 1].sentAt);
                  return (
                    <div key={m.id}>
                      {showDate && (
                        <div style={dateSep}>{fmtDate(m.sentAt)}</div>
                      )}
                      <div style={{
                        display: "flex",
                        justifyContent: m.direction === "OUTBOUND" ? "flex-end" : "flex-start",
                        marginBottom: 6,
                      }}>
                        <div style={m.direction === "OUTBOUND" ? bubbleOut : bubbleIn}>
                          <span style={{ fontSize: "0.88rem", lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            {m.body}
                          </span>
                          <div style={tsStyle}>{fmtTime(m.sentAt)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  display: "flex",
  height: "calc(100vh - 180px)",
  minHeight: 400,
  background: "#22302e",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.05)",
  overflow: "hidden",
};

const listCol: React.CSSProperties = {
  width: 300,
  flexShrink: 0,
  borderRight: "1px solid rgba(255,255,255,0.06)",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
};

const threadCol: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const searchInput: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "#1c2628",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  color: "#f5f1e8",
  fontFamily: "inherit",
  fontSize: "0.82rem",
  outline: "none",
};

const convItem: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 14px",
  background: "transparent",
  border: "none",
  borderLeft: "3px solid transparent",
  cursor: "pointer",
  textAlign: "left",
  transition: "background 0.15s",
};

const convAvatar: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  background: "rgba(186,132,60,0.2)",
  border: "1px solid rgba(186,132,60,0.35)",
  color: "#ba843c",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  fontSize: "0.9rem",
  flexShrink: 0,
};

const convName: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "0.85rem",
  color: "#f5f1e8",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: 140,
};

const convTime: React.CSSProperties = {
  fontSize: "0.68rem",
  color: "rgba(245,241,232,0.4)",
  flexShrink: 0,
};

const convPreview: React.CSSProperties = {
  fontSize: "0.73rem",
  color: "rgba(245,241,232,0.45)",
  marginTop: 2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const threadHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 20px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  background: "#22302e",
  flexShrink: 0,
};

const messagesArea: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px 20px",
  display: "flex",
  flexDirection: "column",
};

const bubbleIn: React.CSSProperties = {
  maxWidth: "72%",
  background: "#1c2628",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "4px 16px 16px 16px",
  padding: "8px 12px",
  color: "#f5f1e8",
};

const bubbleOut: React.CSSProperties = {
  maxWidth: "72%",
  background: "rgba(186,132,60,0.18)",
  border: "1px solid rgba(186,132,60,0.3)",
  borderRadius: "16px 4px 16px 16px",
  padding: "8px 12px",
  color: "#f5f1e8",
};

const tsStyle: React.CSSProperties = {
  fontSize: "0.62rem",
  color: "rgba(245,241,232,0.4)",
  textAlign: "right",
  marginTop: 4,
};

const dateSep: React.CSSProperties = {
  textAlign: "center",
  color: "rgba(245,241,232,0.3)",
  fontSize: "0.7rem",
  margin: "12px 0 8px",
};

const muted: React.CSSProperties = {
  color: "rgba(245,241,232,0.35)",
  fontSize: "0.78rem",
  padding: 20,
  textAlign: "center",
};
