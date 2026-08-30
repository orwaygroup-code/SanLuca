"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SCHEDULE,
  validateSchedule,
  slugKey,
  parseHm,
  formatHm,
  type ScheduleConfig,
  type ScheduleDay,
  type ShiftDef,
} from "@/lib/shifts";

/**
 * Horario del restaurante y turnos de servicio, editables.
 *
 * Antes vivían escritos en duro en lib/shifts.ts; cambiar la hora de cierre o
 * mover el fin del brunch exigía tocar código y desplegar.
 *
 * Cada turno se define con NOMBRE y HORA DE INICIO. Termina donde empieza el
 * siguiente, y el último enlaza con el primero del día siguiente: así las 24
 * horas quedan cubiertas por construcción y no hay manera de dejar un hueco
 * —que significaría ventas sin turno asignado— ni un traslape.
 */

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const C = {
  gold: "var(--sl-gold)",
  cream: "var(--sl-cream)",
  dim: "var(--sl-dim)",
  faint: "var(--sl-faint)",
  green: "var(--sl-green)",
  red: "var(--sl-red)",
  panel: "var(--sl-panel)",
  border: "var(--sl-border)",
  line: "var(--sl-line)",
};

const S: Record<string, React.CSSProperties> = {
  panel: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginTop: 20 },
  head: { padding: "12px 20px", borderBottom: `1px solid ${C.line}`, color: C.faint, fontSize: "0.66rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 },
  body: { padding: 20 },
  label: { display: "block", fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint, fontWeight: 700, marginBottom: 8 },
  input: { padding: "9px 11px", borderRadius: 9, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.05)", color: C.cream, fontSize: "0.9rem", fontFamily: "inherit" },
  row: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" },
  day: { width: 100, color: C.cream, fontSize: "0.85rem", fontWeight: 600 },
  rm: { width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.red}`, background: "transparent", color: C.red, fontSize: "1.1rem", cursor: "pointer", lineHeight: 1, flexShrink: 0 },
  ghost: { padding: "9px 16px", borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.dim, fontWeight: 600, fontSize: "0.82rem", fontFamily: "inherit", cursor: "pointer" },
  save: { padding: "11px 20px", borderRadius: 9, border: "none", background: C.gold, color: "#fff", fontWeight: 700, fontSize: "0.85rem", fontFamily: "inherit" },
  hint: { color: C.faint, fontSize: "0.76rem", lineHeight: 1.5, margin: "0 0 14px" },
};

export function ScheduleEditor() {
  const [days, setDays] = useState<ScheduleDay[]>(DEFAULT_SCHEDULE.days);
  const [shifts, setShifts] = useState<ShiftDef[]>(DEFAULT_SCHEDULE.shifts);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/settings", { credentials: "same-origin" });
    const d = await r.json().catch(() => null);
    const cfg = d?.success ? (d.data?.schedule as ScheduleConfig | null) : null;
    if (cfg?.shifts?.length) {
      setShifts(cfg.shifts);
      if (cfg.days?.length) setDays(DEFAULT_SCHEDULE.days.map((x) => cfg.days.find((y) => y.dow === x.dow) ?? x));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const setDay = (dow: number, patch: Partial<ScheduleDay>) =>
    setDays((ds) => ds.map((d) => (d.dow === dow ? { ...d, ...patch } : d)));
  const setShift = (i: number, patch: Partial<ShiftDef>) =>
    setShifts((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const removeShift = (i: number) => setShifts((ss) => (ss.length > 1 ? ss.filter((_, j) => j !== i) : ss));
  const addShift = () => setShifts((ss) => [...ss, { key: "", name: "", start: "18:00" }]);

  /** Ventana de cada turno, calculada como la calcula el servidor. */
  const preview = (() => {
    const ok = shifts.every((s) => parseHm(s.start) !== null) && shifts.length > 0;
    if (!ok) return [];
    const sorted = [...shifts].sort((a, b) => parseHm(a.start)! - parseHm(b.start)!);
    return sorted.map((s, i) => {
      const end = sorted[(i + 1) % sorted.length];
      return { name: s.name || "(sin nombre)", from: formatHm(parseHm(s.start)!), to: formatHm(parseHm(end.start)!) };
    });
  })();

  const save = async () => {
    const cfg: ScheduleConfig = {
      days,
      shifts: shifts.map((s) => ({ ...s, key: s.key || slugKey(s.name), name: s.name.trim() })),
    };
    const errs = validateSchedule(cfg);
    if (errs.length) { setMsg({ kind: "err", text: errs.join(" ") }); return; }

    setSaving(true);
    const r = await fetch("/api/admin/settings", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule: cfg }),
    });
    const d = await r.json().catch(() => null);
    setSaving(false);
    if (d?.success) { setMsg({ kind: "ok", text: "Horario y turnos guardados." }); void load(); }
    else setMsg({ kind: "err", text: d?.error ?? "No se pudo guardar." });
  };

  return (
    <section style={S.panel}>
      <div style={S.head}>Horario y turnos</div>
      <div style={S.body}>
        <p style={S.hint}>
          Cada turno se define con su nombre y la hora en que <b>empieza</b>. Termina donde
          empieza el siguiente, y el último enlaza con el primero del día siguiente — así el
          día queda cubierto completo, sin huecos donde una venta se quede sin turno.
        </p>

        <label style={S.label}>Turnos</label>
        {shifts.map((s, i) => (
          <div key={i} style={S.row}>
            <input
              style={{ ...S.input, flex: 1, minWidth: 130 }}
              value={s.name}
              placeholder="Nombre del turno"
              onChange={(e) => setShift(i, { name: e.target.value })}
            />
            <input
              style={{ ...S.input, width: 92, textAlign: "center" }}
              value={s.start}
              placeholder="HH:MM"
              inputMode="numeric"
              onChange={(e) => setShift(i, { start: e.target.value })}
            />
            <button onClick={() => removeShift(i)} style={S.rm} aria-label="Quitar turno" disabled={shifts.length <= 1}>×</button>
          </div>
        ))}
        <button onClick={addShift} style={S.ghost}>+ Agregar turno</button>

        {preview.length > 0 && (
          <div style={{ marginTop: 14, color: C.dim, fontSize: "0.8rem", lineHeight: 1.7 }}>
            {preview.map((p, i) => (
              <div key={i}><b style={{ color: C.cream }}>{p.name}</b> · {p.from} a {p.to}</div>
            ))}
          </div>
        )}

        <label style={{ ...S.label, marginTop: 24 }}>Horario de atención</label>
        {days.map((d) => (
          <div key={d.dow} style={S.row}>
            <span style={S.day}>{DIAS[d.dow]}</span>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.dim, fontSize: "0.82rem" }}>
              <input type="checkbox" checked={d.closed} onChange={(e) => setDay(d.dow, { closed: e.target.checked })} />
              Cerrado
            </label>
            {!d.closed && (
              <>
                <input style={{ ...S.input, width: 92, textAlign: "center" }} value={d.open} inputMode="numeric"
                  onChange={(e) => setDay(d.dow, { open: e.target.value })} aria-label={`Apertura ${DIAS[d.dow]}`} />
                <span style={{ color: C.faint }}>a</span>
                <input style={{ ...S.input, width: 92, textAlign: "center" }} value={d.close} inputMode="numeric"
                  onChange={(e) => setDay(d.dow, { close: e.target.value })} aria-label={`Cierre ${DIAS[d.dow]}`} />
              </>
            )}
          </div>
        ))}
        <p style={{ ...S.hint, marginTop: 8 }}>Usa 24:00 para indicar medianoche.</p>

        {msg && (
          <p style={{ marginTop: 16, color: msg.kind === "ok" ? C.green : C.red, fontSize: "0.84rem" }}>
            {msg.kind === "ok" ? "✓ " : "⚠ "}{msg.text}
          </p>
        )}
        <div style={{ marginTop: 20 }}>
          <button onClick={save} disabled={saving} style={{ ...S.save, opacity: saving ? 0.5 : 1, cursor: saving ? "default" : "pointer" }}>
            {saving ? "Guardando…" : "Guardar horario"}
          </button>
        </div>
      </div>
    </section>
  );
}
