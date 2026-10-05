import type { buscador as es } from "../es/buscador";

export const buscador: typeof es = {
  placeholder: "Search products, brands and more…",
  aria: "Search the store",
  buscar: "Search",
  cerrarSugerencias: "Close suggestions",
  sinResultados: (q: string) => `No results for “${q}”`,
  sinResultadosAyuda: "Try another word or browse the categories.",
  resultadosPara: (q: string) => `Results for “${q}”`,
  verTodos: (n: number) => `See all results (${n})`,
};
