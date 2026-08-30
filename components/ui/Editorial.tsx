import { colors, fonts } from "@/config/theme";

/* ── Gold decorative line ── */
export function GoldLine({ width = 60 }: { width?: number }) {
  return (
    <div
      style={{
        width,
        height: 1,
        background: colors.peru,
        opacity: 0.4,
        margin: "20px 0",
      }}
    />
  );
}

/* ── Section label (01 — Filosofía) ── */
export function Label({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <div
      style={{
        fontFamily: fonts.primary,
        fontSize: "0.65rem",
        fontWeight: 800,
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        color: light ? "rgb(var(--sl-cream-rgb) / 0.35)" : "rgba(28,38,40,0.35)",
      }}
    >
      {children}
    </div>
  );
}

/* ── Cursive script accent ── */
export function Script({
  children,
  color = colors.peru,
  size = "1.3rem",
}: {
  children: React.ReactNode;
  color?: string;
  size?: string;
}) {
  return (
    <div
      style={{
        fontFamily: fonts.script,
        fontSize: size,
        color,
        opacity: 0.85,
      }}
    >
      {children}
    </div>
  );
}

/* ── Stone/paper texture overlay ── */
export function Texture({ dark = true }: { dark?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: dark ? 0.05 : 0.025,
        pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='${dark ? "0.75" : "0.6"}' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}
