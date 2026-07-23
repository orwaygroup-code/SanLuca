# Design

Sistema visual de los **paneles operativos** (staff/admin) de San Luca. El sitio
público (marketing) tiene su propio lenguaje editorial cream/oscuro y no se rige
por este documento. Registro: **product** (ver PRODUCT.md).

## Theme

Tema oscuro fijo. Las tablets se usan bajo luz natural brillante (8–13 h) y
ambiente oscuro (13 h–cierre): por eso los pisos de contraste de abajo son
**mínimos duros**, no sugerencias.

## Color

| Rol | Valor | Nota |
|---|---|---|
| Fondo página | `#16201f` | |
| Panel / superficie | `#1a2628` · `#1f2d2c` | segunda capa para tarjetas internas |
| Dorado marca/acción | `#ba843c` | botones sólidos, con **tinta `#16201f` encima** (5.1:1 AA) — nunca texto blanco sobre dorado (3.3:1, falla) |
| Dorado claro (texto) | `#c9964a` | texto/íconos dorados pequeños sobre oscuro |
| Tinta principal | `#f5f1e8` | |
| Tinta secundaria | `rgba(245,241,232,0.68)` | ≈7:1 |
| Tinta terciaria / labels | `rgba(245,241,232,0.55)` | ≈5:1 — **piso AA, no bajar** |
| Error (texto) | `#e8766b` | sobre oscuro ≈5.7:1 |
| Danger (fondo botón) | `#b23730` | con texto blanco ≈5.5:1 |

**Estados** (siempre como TEXTO/borde sobre oscuro, nunca fondo con texto blanco):
`OPEN #6fa3e0` · `IN_SERVICE #57b586` · `AWAITING_PAYMENT #e0b054` ·
`CANCELLED #e8766b` · `PAID/archivados blanco 0.5–0.6` — y en reservas:
`PENDING #c9964a` · `CONFIRMED #63aede` · `IN_PROGRESS #5cbf60` ·
`DELAYED #e8766b` · `NO_SHOW #d95f4a`.

## Typography

- Una sola familia en los paneles: `MontecatiniPro` (`--font-primary`). Sin
  fuentes display en labels, botones o datos.
- Escala fija en rem (sin clamp en paneles). Labels uppercase 0.62–0.64rem con
  tracking 0.14em, color tinta secundaria (no terciaria).

## Components

- **Botón primario**: dorado sólido + tinta oscura, radius 9–10, `minHeight 44`.
- **Ghost**: borde `rgba(255,255,255,0.18)`, texto secundario, `minHeight 44`.
- **Danger**: `#b23730` + blanco.
- **Badge de estado**: outline + tinte (`color-mix 12%`), el color va en el
  TEXTO. Nunca fondo saturado con texto blanco.
- **Inputs**: bg blanco 5%, borde blanco 0.18–0.2, `minHeight 44`.
- **Modales**: panel + borde dorado 0.3, radius 16, overlay negro 0.6–0.7.
- **Toasts**: borde 1px completo del tipo + tinte, `aria-live="polite"`.
  Prohibido el side-stripe (`border-left` grueso de color).
- **"Nueva" (reserva no vista)**: puntito pulsante `#e8766b`; se detiene con
  `prefers-reduced-motion`.

## Accesibilidad (WCAG AA)

- `:focus-visible` global: outline dorado 2px + offset 2px (en san-luca.css).
- Targets táctiles ≥44px (40px tolerado solo en tablas densas de admin).
- `prefers-reduced-motion` global: mata animaciones/transiciones.
- Contraste: texto normal ≥4.5:1, grande ≥3:1 — los tokens de arriba ya lo
  garantizan; si agregas un tono nuevo, verifícalo antes.
