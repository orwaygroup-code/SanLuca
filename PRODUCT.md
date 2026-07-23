# Product

## Register

product

## Users

- **Staff operativo de San Luca Ristorante** (Aguascalientes) usando **tablets** durante el servicio: meseros (WAITER), hostess/caja (OPERATION), capitán (CAPTAIN) y manager (MANAGER). Login con PIN de 4 dígitos. Trabajan con prisa real, de pie, con una mano.
- **Ricardo (ADMIN)** gestiona reservas, empleados y CRM desde desktop/móvil.
- **Contexto de luz**: brunch con luz natural brillante (8:00–13:00) y ambiente oscuro de la 1 pm al cierre → la misma UI debe leerse en ambos extremos.

## Product Purpose

Sistema operativo del restaurante: comandas (mesero → cocina/barra → caja con impresión física vía PrintBridge), reservas (bot WhatsApp con auto-confirmación + panel), empleados y CRM. Éxito = un mesero captura y envía una comanda sin pensar en la interfaz, y la hostess distingue de un vistazo qué requiere su acción ("Nueva", "Revisar mesas", PENDING).

## Brand Personality

Premium italiano, sobrio, confiable. En los paneles la elegancia se **subordina a la claridad**: oscuro + dorado como identidad, pero primero legible y rápido. Tres palabras: **claro, cálido, seguro**.

## Anti-references

- Dashboards SaaS genéricos: hero-metrics con gradientes, grids infinitos de cards idénticas.
- Texto gris "elegante" que no se lee bajo luz de día en la terraza.
- Decoración que estorba al pulgar: targets chicos, acciones escondidas en menús.

## Design Principles

1. **Servicio primero** — cada pantalla optimiza la tarea del turno (capturar, enviar, cobrar), no la estética.
2. **Legible en terraza y en cena** — contraste AA real (≥4.5:1) en todo texto de trabajo; nada de gris decorativo.
3. **Táctil generoso** — targets ≥44px; las acciones frecuentes más grandes y al alcance del pulgar.
4. **Estado visible** — lo nuevo/pendiente/urgente se distingue de un vistazo, con colores de significado estable en todos los paneles.
5. **Una sola identidad** — mismo dorado/oscuro/tipografía en todos los paneles; sin islas de estilo.

## Accessibility & Inclusion

**WCAG AA formal**: contraste ≥4.5:1 en texto normal y ≥3:1 en texto grande, foco visible en todo elemento interactivo, targets táctiles ≥44px, `prefers-reduced-motion` respetado en cualquier animación.
