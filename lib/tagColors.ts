/**
 * Tokens de color permitidos para `Tag.color`. Ver wiki [[Conversation Tags]] §Notas de diseño.
 *
 * Nota de divergencia con el wiki: el wiki menciona "mapping a clases Tailwind"
 * pero este proyecto no usa Tailwind — solo CSS-in-JS con estilos inline y
 * `styles/san-luca.css`. El mapping devuelve un objeto `{ bg, border, text }`
 * que las pills usan directamente en `style={{...}}`.
 */

export const TAG_COLORS = [
  "slate",
  "red",
  "amber",
  "green",
  "blue",
  "violet",
  "pink",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export const DEFAULT_TAG_COLOR: TagColor = "slate";

export interface TagSwatch {
  /** Background pill — relleno suave para dark UI. */
  bg:     string;
  /** Borde de la pill, ~50% más opaco que el fill. */
  border: string;
  /** Texto encima del fill. Alto contraste sobre el dark theme. */
  text:   string;
}

/**
 * Mapping fijo de token → estilo. Sintonizado para el tema oscuro del CRM
 * (fondo ~`#22302e` / `#1c2628`). Los colores base son los de la paleta
 * "tailwind-ish" — slate-500, red-500, amber-500, etc. — pero traducidos a
 * hex específicos del proyecto.
 */
const SWATCHES: Record<TagColor, TagSwatch> = {
  slate:  { bg: "rgba(148,163,184,0.18)", border: "rgba(148,163,184,0.45)", text: "#cbd5e1" },
  red:    { bg: "rgba(224,85,85,0.18)",   border: "rgba(224,85,85,0.50)",   text: "#fca5a5" },
  amber:  { bg: "rgba(186,132,60,0.20)",  border: "rgba(186,132,60,0.55)",  text: "#fbbf24" },
  green:  { bg: "rgba(95,161,95,0.20)",   border: "rgba(95,161,95,0.55)",   text: "#86efac" },
  blue:   { bg: "rgba(74,158,202,0.20)",  border: "rgba(74,158,202,0.55)",  text: "#93c5fd" },
  violet: { bg: "rgba(167,139,250,0.20)", border: "rgba(167,139,250,0.55)", text: "#c4b5fd" },
  pink:   { bg: "rgba(244,114,182,0.20)", border: "rgba(244,114,182,0.55)", text: "#f9a8d4" },
};

export function swatch(color: string | null | undefined): TagSwatch {
  if (color && (TAG_COLORS as readonly string[]).includes(color)) {
    return SWATCHES[color as TagColor];
  }
  return SWATCHES[DEFAULT_TAG_COLOR];
}

export function isValidTagColor(value: unknown): value is TagColor {
  return typeof value === "string" && (TAG_COLORS as readonly string[]).includes(value);
}
