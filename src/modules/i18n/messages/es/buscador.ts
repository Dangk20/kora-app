// Área "buscador" de la tienda: la caja del header y su desplegable.
// `en/buscador.ts` debe tener la misma forma.
export const buscador = {
  placeholder: "Buscar productos, marcas y más…",
  aria: "Buscar en la tienda",
  buscar: "Buscar",
  cerrarSugerencias: "Cerrar sugerencias",
  sinResultados: (q: string) => `Sin resultados para “${q}”`,
  sinResultadosAyuda: "Prueba con otra palabra o explora las categorías.",
  resultadosPara: (q: string) => `Resultados para “${q}”`,
  verTodos: (n: number) => `Ver todos los resultados (${n})`,
};
