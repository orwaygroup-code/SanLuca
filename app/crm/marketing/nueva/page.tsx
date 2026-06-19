"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CrmPageHead } from "@/components/crm/CrmPageHead";
import { WhatsAppPreview } from "@/components/crm/marketing/WhatsAppPreview";
import { TagMultiSelector } from "@/components/crm/marketing/TagMultiSelector";
import {
  fetchTemplates,
  previewCampaign,
  createCampaign,
} from "@/lib/marketing-mock";
import type {
  CampaignPreview,
  MetaTemplate,
  TagFilterMode,
  TagFilterSource,
} from "@/types/marketing";

export default function NewCampaignPage() {
  const router = useRouter();

  const [templates, setTemplates] = useState<MetaTemplate[] | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");

  const [campaignName, setCampaignName]   = useState("");
  const [params, setParams]               = useState<Record<string, string>>({});
  const [headerImageUrl, setHeaderImageUrl] = useState<string>("");

  const [tagIds, setTagIds]   = useState<string[]>([]);
  const [mode, setMode]       = useState<TagFilterMode>("any");
  const [source, setSource]   = useState<TagFilterSource>("both");

  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview]       = useState<CampaignPreview | null>(null);

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt]         = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchTemplates().then((tpls) => {
      if (!alive) return;
      setTemplates(tpls);
      if (tpls.length > 0) {
        setSelectedTemplateName(tpls[0].name);
        setParams(
          Object.fromEntries(tpls[0].variables.map((v) => [String(v.index), v.example])),
        );
      }
    });
    return () => { alive = false; };
  }, []);

  const template = useMemo(
    () => templates?.find((t) => t.name === selectedTemplateName) ?? null,
    [templates, selectedTemplateName],
  );

  function handleTemplateChange(name: string) {
    setSelectedTemplateName(name);
    const t = templates?.find((x) => x.name === name);
    if (t) {
      setParams(Object.fromEntries(t.variables.map((v) => [String(v.index), v.example])));
      setHeaderImageUrl(t.headerExample ?? "");
    }
    setPreview(null);
  }

  async function handlePreview() {
    setPreviewing(true);
    setErr(null);
    try {
      const p = await previewCampaign({ tagIds, mode, source });
      setPreview(p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo obtener vista previa");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave(action: "draft" | "send" | "schedule") {
    if (!template) { setErr("Selecciona un template"); return; }
    if (!campaignName.trim()) { setErr("Ponle nombre a la campaña"); return; }
    if (tagIds.length === 0) { setErr("Selecciona al menos un tag"); return; }
    if (action === "schedule" && !scheduledAt) { setErr("Define fecha y hora"); return; }

    setSaving(true);
    setErr(null);
    try {
      await createCampaign({
        name: campaignName.trim(),
        templateName: template.name,
        templateLanguage: template.language,
        templateParams: params,
        headerImageUrl: template.headerType === "IMAGE" ? (headerImageUrl || null) : null,
        filters: { tagIds, mode, source },
        scheduledAt: action === "schedule" ? new Date(scheduledAt).toISOString() : null,
      });
      router.push("/crm/marketing");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo crear la campaña");
      setSaving(false);
    }
  }

  if (templates === null) {
    return (
      <>
        <CrmPageHead accent="MARKETING" title="NUEVA CAMPAÑA" sub="Cargando templates aprobados…" />
        <p style={muted}>Cargando…</p>
      </>
    );
  }

  return (
    <>
      <CrmPageHead accent="MARKETING" title="NUEVA CAMPAÑA" sub="Selecciona template y tags · WhatsApp Business" />

      <div style={topNav}>
        <Link href="/crm/marketing" style={backBtn}>
          ← Volver a campañas
        </Link>
      </div>

      <div style={layout}>
        {/* ── Columna izquierda — Form ─────────────────────────────── */}
        <div style={formCol}>
          {/* 1. Nombre */}
          <Section title="1. Nombre interno de la campaña">
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ej: Promo San Valentín 2026"
              style={input}
              maxLength={80}
            />
            <p style={hint}>
              Solo lo ves tú aquí en el CRM — el cliente nunca lo lee.
            </p>
          </Section>

          {/* 2. Template */}
          <Section title="2. Template aprobado por Meta">
            <select
              value={selectedTemplateName}
              onChange={(e) => handleTemplateChange(e.target.value)}
              style={select}
            >
              {templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} · {t.category} · {t.language}
                </option>
              ))}
            </select>
            <p style={hint}>
              Los templates se crean y aprueban en Meta Business Manager — ahí están los actuales.
            </p>
          </Section>

          {/* 3. Variables */}
          {template && template.variables.length > 0 && (
            <Section title="3. Variables del template">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {template.variables.map((v) => (
                  <div key={v.index}>
                    <label style={labelStyle}>
                      <code style={codeInline}>{`{{${v.index}}}`}</code> {v.label}
                    </label>
                    <input
                      value={params[String(v.index)] ?? ""}
                      onChange={(e) => setParams({ ...params, [String(v.index)]: e.target.value })}
                      placeholder={v.example}
                      style={input}
                    />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 4. Imagen del header (si template lo soporta) */}
          {template?.headerType === "IMAGE" && (
            <Section title="4. Imagen del header">
              <input
                value={headerImageUrl}
                onChange={(e) => setHeaderImageUrl(e.target.value)}
                placeholder="https://… o ruta /images/menu/clasica/paste.png"
                style={input}
              />
              <p style={hint}>
                URL pública absoluta o ruta local desde <code>/public</code>.
                Si la dejas vacía se usa la imagen de ejemplo del template.
              </p>
            </Section>
          )}

          {/* 5. Filtros */}
          <Section title={`${template?.headerType === "IMAGE" ? "5" : "4"}. ¿A quién enviar?`}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Tags requeridos</label>
              <TagMultiSelector selectedTagIds={tagIds} onChange={setTagIds} />
            </div>

            <div style={twoCol}>
              <div>
                <label style={labelStyle}>Fuente de tags</label>
                <div style={radioRow}>
                  <RadioPill checked={source === "conv"} onClick={() => setSource("conv")} label="Chats" />
                  <RadioPill checked={source === "user"} onClick={() => setSource("user")} label="Clientes" />
                  <RadioPill checked={source === "both"} onClick={() => setSource("both")} label="Ambos" />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Modo de filtro</label>
                <div style={radioRow}>
                  <RadioPill checked={mode === "any"} onClick={() => setMode("any")} label="Cualquier tag (OR)" />
                  <RadioPill checked={mode === "all"} onClick={() => setMode("all")} label="Todos los tags (AND)" />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewing || tagIds.length === 0}
                style={{ ...secondaryBtn, opacity: previewing || tagIds.length === 0 ? 0.5 : 1 }}
              >
                {previewing ? "Calculando…" : "Vista previa de destinatarios"}
              </button>
              {preview && (
                <div style={previewBadge}>
                  <strong style={{ color: "#ba843c", fontSize: "1.05rem" }}>{preview.estimatedTotal}</strong>
                  <span style={{ marginLeft: 6 }}>personas serán contactadas</span>
                </div>
              )}
            </div>

            {preview && preview.sampleTargets.length > 0 && (
              <div style={sampleBox}>
                <p style={{ margin: "0 0 8px", color: "rgba(245,241,232,0.55)", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Primeros destinatarios
                </p>
                <ul style={sampleList}>
                  {preview.sampleTargets.map((t, i) => (
                    <li key={i} style={sampleItem}>
                      <span style={{ color: "#f5f1e8" }}>{t.name ?? t.phone}</span>
                      <span style={{ marginLeft: 8, color: "rgba(245,241,232,0.4)", fontSize: "0.75rem" }}>
                        {t.tagNames.join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* 6. Programar */}
          <Section title={`${template?.headerType === "IMAGE" ? "6" : "5"}. ¿Cuándo enviar?`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={radioLine}>
                <input
                  type="radio"
                  checked={!scheduleEnabled}
                  onChange={() => setScheduleEnabled(false)}
                />
                <span style={{ color: "#f5f1e8", fontSize: "0.86rem" }}>Enviar ahora (al crear)</span>
              </label>
              <label style={radioLine}>
                <input
                  type="radio"
                  checked={scheduleEnabled}
                  onChange={() => setScheduleEnabled(true)}
                />
                <span style={{ color: "#f5f1e8", fontSize: "0.86rem" }}>Programar fecha y hora</span>
              </label>
              {scheduleEnabled && (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  style={{ ...input, maxWidth: 280, colorScheme: "dark" }}
                />
              )}
            </div>
          </Section>

          {err && (
            <div style={errBox}>⚠ {err}</div>
          )}

          {/* Acciones */}
          <div style={actionsRow}>
            <button
              type="button"
              onClick={() => handleSave("draft")}
              disabled={saving}
              style={ghostBtn}
            >
              Guardar borrador
            </button>
            <button
              type="button"
              onClick={() => handleSave(scheduleEnabled ? "schedule" : "send")}
              disabled={saving}
              style={primaryBtn}
            >
              {saving
                ? "Guardando…"
                : scheduleEnabled
                ? "Programar campaña"
                : "Crear y enviar ahora"}
            </button>
          </div>
        </div>

        {/* ── Columna derecha — Preview sticky ─────────────────────── */}
        <aside style={previewCol}>
          <p style={previewLabel}>VISTA PREVIA DEL CLIENTE</p>
          {template ? (
            <WhatsAppPreview
              template={template}
              params={params}
              headerImageUrl={template.headerType === "IMAGE" ? (headerImageUrl || null) : null}
            />
          ) : (
            <p style={muted}>Selecciona un template para ver el preview.</p>
          )}
        </aside>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={section}>
      <h3 style={sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

function RadioPill({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...pillBase,
        background: checked ? "#ba843c"           : "transparent",
        color:      checked ? "#1c2628"           : "rgba(245,241,232,0.7)",
        border:     checked ? "1px solid #ba843c" : "1px solid rgba(245,241,232,0.18)",
        fontWeight: checked ? 700                 : 500,
      }}
    >
      {label}
    </button>
  );
}

// ── Estilos ─────────────────────────────────────────────────────────────

const topNav: React.CSSProperties = { marginBottom: 16 };

const backBtn: React.CSSProperties = {
  color: "rgba(245,241,232,0.55)",
  textDecoration: "none",
  fontSize: "0.82rem",
  fontFamily: "inherit",
};

const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 340px",
  gap: 28,
  alignItems: "start",
};

const formCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const previewCol: React.CSSProperties = {
  position: "sticky",
  top: 80,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
};

const previewLabel: React.CSSProperties = {
  fontSize: "0.66rem",
  letterSpacing: "0.22em",
  color: "rgba(245,241,232,0.45)",
  fontWeight: 700,
  margin: 0,
};

const section: React.CSSProperties = {
  background: "#22302e",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: 14,
  padding: "18px 20px",
};

const sectionTitle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: "0.86rem",
  fontWeight: 600,
  color: "#f5f1e8",
  letterSpacing: "0.01em",
};

const input: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "10px 14px",
  color: "#f5f1e8",
  fontFamily: "inherit",
  fontSize: "0.88rem",
  outline: "none",
  boxSizing: "border-box",
};

const select: React.CSSProperties = {
  ...input,
  cursor: "pointer",
  appearance: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "rgba(245,241,232,0.75)",
  fontSize: "0.78rem",
  fontWeight: 500,
};

const hint: React.CSSProperties = {
  marginTop: 6,
  color: "rgba(245,241,232,0.4)",
  fontSize: "0.72rem",
  lineHeight: 1.5,
};

const codeInline: React.CSSProperties = {
  background: "rgba(186,132,60,0.10)",
  color: "#ba843c",
  padding: "1px 6px",
  borderRadius: 4,
  fontFamily: "monospace",
  fontSize: "0.78rem",
  marginRight: 6,
};

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const radioRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const pillBase: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 999,
  fontFamily: "inherit",
  fontSize: "0.74rem",
  cursor: "pointer",
};

const previewBadge: React.CSSProperties = {
  background: "rgba(186,132,60,0.10)",
  border: "1px solid rgba(186,132,60,0.35)",
  color: "#f5f1e8",
  padding: "8px 14px",
  borderRadius: 999,
  fontSize: "0.82rem",
};

const sampleBox: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.04)",
  borderRadius: 10,
};

const sampleList: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const sampleItem: React.CSSProperties = {
  fontSize: "0.82rem",
};

const radioLine: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
};

const errBox: React.CSSProperties = {
  background: "rgba(224,85,85,0.08)",
  border: "1px solid rgba(224,85,85,0.35)",
  color: "#e05555",
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: "0.85rem",
};

const actionsRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  justifyContent: "flex-end",
};

const primaryBtn: React.CSSProperties = {
  background: "#ba843c",
  color: "#1c2628",
  padding: "12px 24px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: "0.82rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  fontFamily: "inherit",
  border: "none",
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  background: "rgba(186,132,60,0.10)",
  color: "#ba843c",
  border: "1px solid rgba(186,132,60,0.40)",
  padding: "8px 16px",
  borderRadius: 999,
  fontWeight: 600,
  fontSize: "0.78rem",
  cursor: "pointer",
  fontFamily: "inherit",
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: "rgba(245,241,232,0.55)",
  border: "1px solid rgba(245,241,232,0.18)",
  padding: "12px 22px",
  borderRadius: 999,
  fontWeight: 600,
  fontSize: "0.78rem",
  letterSpacing: "0.04em",
  fontFamily: "inherit",
  cursor: "pointer",
};

const muted: React.CSSProperties = {
  color: "rgba(245,241,232,0.5)",
  fontSize: "0.85rem",
};
