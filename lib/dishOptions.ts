/**
 * Opciones por platillo (Fase Brunch B-2). PURO, sin base de datos.
 *
 * Un platillo puede declarar grupos de opciones en `Dish.options` (Json). El mesero
 * elige y `resolveSelection` valida, arma el texto de `modifiers`, calcula el costo
 * extra y congela la selección en `ComandaItem.optionsSnapshot`. El PRECIO sale
 * SIEMPRE del grupo declarado en el platillo, nunca de lo que mande el cliente.
 *
 * `desc` (en grupo y en choice) es SOLO texto descriptivo para la carta: no entra
 * en modifiers, ni en extraCost, ni en el snapshot.
 */

export interface OptionChoice { label: string; price?: number; desc?: string }
export interface OptionGroup { group: string; required: boolean; max: number; choices: OptionChoice[]; desc?: string }
export interface OptionPick { group: string; label: string; price?: number }

/** Lee `Dish.options` (ya parseado por Prisma, o un string JSON) → grupos válidos. Tolerante: JSON inválido o forma inesperada → []. */
export function parseDishOptions(raw: unknown): OptionGroup[] {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try { data = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(data)) return [];

  const groups: OptionGroup[] = [];
  for (const g of data) {
    if (!g || typeof g !== "object") continue;
    const gg = g as Record<string, unknown>;
    if (typeof gg.group !== "string" || !Array.isArray(gg.choices)) continue;
    const choices: OptionChoice[] = [];
    for (const c of gg.choices) {
      if (!c || typeof c !== "object") continue;
      const cc = c as Record<string, unknown>;
      if (typeof cc.label !== "string") continue;
      const choice: OptionChoice = { label: cc.label };
      if (typeof cc.price === "number" && Number.isFinite(cc.price)) choice.price = cc.price;
      if (typeof cc.desc === "string") choice.desc = cc.desc;
      choices.push(choice);
    }
    const group: OptionGroup = {
      group: gg.group,
      required: gg.required === true,
      max: typeof gg.max === "number" && gg.max > 0 ? gg.max : 1,
      choices,
    };
    if (typeof gg.desc === "string") group.desc = gg.desc;
    groups.push(group);
  }
  return groups;
}

/**
 * Valida la selección del mesero contra los grupos del platillo.
 * - Cada pick debe existir en su grupo por nombre exacto → "Opción no válida: <label>".
 * - Grupo required sin pick → "Elige <grupo>".
 * - Más picks que `max` en un grupo → "Solo puedes elegir <max> en <grupo>".
 * - extraCost = suma de los `price` de lo elegido (sin price vale 0), SIEMPRE tomado
 *   del grupo declarado, nunca del pick recibido.
 * - modifiers = los labels elegidos unidos con " · ", en el orden de los grupos.
 * - Sin grupos y sin picks → { ok:true, modifiers:"", extraCost:0, snapshot:[] }.
 */
export function resolveSelection(
  groups: OptionGroup[],
  picks: { group: string; label: string }[],
):
  | { ok: true; modifiers: string; extraCost: number; snapshot: OptionPick[] }
  | { ok: false; error: string } {
  // 1) Cada pick debe existir en su grupo por label exacto.
  for (const p of picks) {
    const g = groups.find((x) => x.group === p.group);
    const choice = g?.choices.find((c) => c.label === p.label);
    if (!g || !choice) return { ok: false, error: `Opción no válida: ${p.label}` };
  }

  // 2) required y max por grupo.
  for (const g of groups) {
    const chosen = picks.filter((p) => p.group === g.group);
    if (g.required && chosen.length === 0) return { ok: false, error: `Elige ${g.group}` };
    if (chosen.length > g.max) return { ok: false, error: `Solo puedes elegir ${g.max} en ${g.group}` };
  }

  // 3) Arma snapshot/modifiers/extraCost en el ORDEN de los grupos; precio del grupo.
  const snapshot: OptionPick[] = [];
  const labels: string[] = [];
  let extraCost = 0;
  for (const g of groups) {
    for (const p of picks.filter((x) => x.group === g.group)) {
      const choice = g.choices.find((c) => c.label === p.label)!; // ya validado arriba
      labels.push(choice.label);
      if (choice.price != null) {
        extraCost += choice.price;
        snapshot.push({ group: g.group, label: choice.label, price: choice.price });
      } else {
        snapshot.push({ group: g.group, label: choice.label });
      }
    }
  }
  return { ok: true, modifiers: labels.join(" · "), extraCost, snapshot };
}
