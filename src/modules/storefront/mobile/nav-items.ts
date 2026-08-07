// Los cuatro accesos de la barra inferior móvil y, sobre todo, QUÉ RUTAS marca
// cada uno como actual.
//
// Vive aparte del componente porque es lógica, no presentación: se puede probar
// sin renderizar nada, y la regla de la ficha de producto (§4 del design) se
// merece una prueba propia.

import { Home, LayoutGrid, ShoppingCart, User } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  /** Qué rutas marcan este acceso como el actual. */
  match: (path: string) => boolean;
};

export const NAV_ITEMS: NavItem[] = [
  // Igualdad exacta, no `startsWith`: con `startsWith("/")` Inicio se
  // encendería en todas las rutas, y sería un error que nadie ve.
  { href: "/", label: "Inicio", icon: Home, match: (p) => p === "/" },
  {
    href: "/catalogo",
    label: "Catálogo",
    // `LayoutGrid` (cuatro cuadrados) y NO `Grid3x3` (una cuadrícula de
    // líneas): el diseño marca el acceso activo rellenando el icono, y
    // rellenar una cuadrícula de líneas produce un bloque macizo en vez de un
    // icono. Cuatro cuadrados se rellenan siendo lo que son.
    icon: LayoutGrid,
    // La ficha de producto pertenece al catálogo. Dejar los cuatro accesos
    // apagados mientras se mira un producto —que es donde el comprador pasa
    // más tiempo antes de comprar— comunica "estás fuera de la tienda" justo
    // en ese momento.
    match: (p) => p.startsWith("/catalogo") || p.startsWith("/producto"),
  },
  {
    href: "/carrito",
    label: "Carrito",
    icon: ShoppingCart,
    match: (p) => p.startsWith("/carrito"),
  },
  { href: "/cuenta", label: "Cuenta", icon: User, match: (p) => p.startsWith("/cuenta") },
];
