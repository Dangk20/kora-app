// Chrome de la tienda en móvil: header, barra inferior y menú lateral.
export const movil = {
  abrirCarrito: (n: number) => (n > 0 ? `Abrir carrito: ${n} artículos` : "Abrir carrito (vacío)"),
  abrirMenu: "Abrir menú",
  cerrarMenu: "Cerrar menú",
  menu: "Menú",
  buscarPlaceholder: "Buscar productos, marcas…",
  buscarEnTienda: "Buscar en la tienda",
  buscar: "Buscar",
  navegacionPrincipal: "Navegación principal",
  /** Por ruta de la barra inferior. */
  nav: { "/": "Inicio", "/catalogo": "Catálogo", "/carrito": "Carrito", "/cuenta": "Cuenta" } as Record<string, string>,
  categorias: "CATEGORÍAS",
  tuCuenta: "TU CUENTA",
  miCuenta: "Mi cuenta",
  escribenosWhatsapp: "Escríbenos por WhatsApp",
  idioma: "IDIOMA",
};
