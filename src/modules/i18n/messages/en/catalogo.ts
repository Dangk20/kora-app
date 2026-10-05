import type { catalogo as es } from "../es/catalogo";

export const catalogo: typeof es = {
  meta: {
    titulo: "Catalog",
    descripcion:
      "Browse the full KORA catalog by category, brand and price. Shop online and finish your order over WhatsApp.",
  },
  inicio: "Home",
  busqueda: "Search",
  catalogo: "Catalog",
  resultadosPara: (q: string) => `Results for "${q}"`,
  todosLosProductos: "All products",
  conteo: (n: number) => `${n} ${n === 1 ? "product" : "products"}`,
  categorias: "Categories",
  limpiar: "Clear",
  todas: "All",
  todasLasCategorias: "All categories",
  filtros: "Filters",
  ordenarPor: "Sort by",
  orden: {
    relevancia: "Relevance",
    precioAsc: "Price: low to high",
    precioDesc: "Price: high to low",
    nombre: "Name (A-Z)",
  },
  cerrar: "Close",
  vacio: {
    titulo: "No products match these filters",
    texto: "Try removing one.",
    boton: "View the full catalog",
  },
  cargarMas: (n: number) => `Load more (${n})`,
  cargando: "Loading…",
  errorCargarMas: "We couldn't load more products. Please try again.",
  cargandoProductos: "Loading products",
  tarjeta: {
    agotado: "Sold out",
    destacado: "Featured",
    precioOnline: "Online price",
    verProducto: "View product",
    desdeVariantes: (n: number) => `From · ${n} options`,
  },
};
