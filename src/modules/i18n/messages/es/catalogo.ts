// Área "catalogo": listado, filtros, orden y tarjeta de producto. `en/catalogo.ts`
// debe tener exactamente la misma forma.
export const catalogo = {
  meta: {
    titulo: "Catálogo",
    descripcion:
      "Explora todo el catálogo de KORA por categoría, marca y precio. Compra en línea y coordina tu pedido por WhatsApp.",
  },
  inicio: "Inicio",
  busqueda: "Búsqueda",
  catalogo: "Catálogo",
  resultadosPara: (q: string) => `Resultados para "${q}"`,
  todosLosProductos: "Todos los productos",
  conteo: (n: number) => `${n} ${n === 1 ? "producto" : "productos"}`,
  categorias: "Categorías",
  limpiar: "Limpiar",
  todas: "Todas",
  todasLasCategorias: "Todas las categorías",
  filtros: "Filtros",
  ordenarPor: "Ordenar por",
  orden: {
    relevancia: "Relevancia",
    precioAsc: "Menor precio",
    precioDesc: "Mayor precio",
    nombre: "Nombre (A-Z)",
  } as Record<"relevancia" | "precioAsc" | "precioDesc" | "nombre", string>,
  cerrar: "Cerrar",
  vacio: {
    titulo: "No encontramos productos con esos filtros",
    texto: "Prueba quitando alguno.",
    boton: "Ver todo el catálogo",
  },
  cargarMas: (n: number) => `Cargar más (${n})`,
  cargando: "Cargando…",
  errorCargarMas: "No se pudieron cargar más productos. Intenta de nuevo.",
  cargandoProductos: "Cargando productos",
  tarjeta: {
    agotado: "Agotado",
    destacado: "Destacado",
    precioOnline: "Precio online",
    verProducto: "Ver producto",
    desdeVariantes: (n: number) => `Desde · ${n} variantes`,
  },
};
