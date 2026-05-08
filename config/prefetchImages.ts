/**
 * Imágenes que precargamos después del hero para que la navegación
 * a /reservation y /menu sea instantánea para nuevos usuarios.
 */

// Áreas (form de reservación)
export const AREA_IMAGES = [
  "/images/areas/terraza.jpg",
  "/images/areas/pAlta.jpg",
  "/images/areas/salon.jpg",
  "/images/areas/privado.jpg",
];

// Portadas del menú
export const MENU_PORTADAS = [
  "/images/menu/clasica/antipaste.png",
  "/images/menu/clasica/paste.png",
  "/images/menu/clasica/pizza.png",
  "/images/menu/clasica/risoto.png",
  "/images/menu/clasica/ensalada.png",
  "/images/menu/clasica/terra.png",
  "/images/menu/clasica/pesce.png",
  "/images/menu/brunch/portadas/platti-salati.jpg",
  "/images/menu/brunch/portadas/toasts-panini.jpg",
  "/images/menu/brunch/portadas/omelettes.jpg",
  "/images/menu/brunch/portadas/especiales.jpg",
  "/images/menu/brunch/portadas/panetteria-dolci.png",
];

// Hero del menú (segunda navegación común)
export const MENU_HERO = ["/images/hero-menu.jpg"];

export const PREFETCH_AFTER_HERO = [...AREA_IMAGES, ...MENU_PORTADAS, ...MENU_HERO];
