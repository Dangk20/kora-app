import type { movil as es } from "../es/movil";

export const movil: typeof es = {
  abrirCarrito: (n) => (n > 0 ? `Open cart: ${n} ${n === 1 ? "item" : "items"}` : "Open cart (empty)"),
  abrirMenu: "Open menu",
  cerrarMenu: "Close menu",
  menu: "Menu",
  buscarPlaceholder: "Search products, brands…",
  buscarEnTienda: "Search the store",
  buscar: "Search",
  navegacionPrincipal: "Main navigation",
  nav: { "/": "Home", "/catalogo": "Shop", "/carrito": "Cart", "/cuenta": "Account" },
  categorias: "CATEGORIES",
  tuCuenta: "YOUR ACCOUNT",
  miCuenta: "My account",
  escribenosWhatsapp: "Message us on WhatsApp",
  idioma: "LANGUAGE",
};
