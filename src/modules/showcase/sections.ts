// VITRINA — definición de las secciones de la página de inicio.
//
// Las secciones son FIJAS: son las del prototipo aprobado y su orden es el
// de la página. El operador decide el contenido, no la estructura. Esta lista
// es la fuente de verdad: la tienda y el panel de Vitrina la leen igual, así
// que el panel siempre es un espejo exacto de la página.

export type SectionKey =
  | "top_categorias"
  | "mejor_semana"
  | "ofertas"
  | "destacados"
  | "mejor_valorados";

export type BannerSlot = "hero_principal" | "hero_lateral" | "promo_secundaria";

export type SectionDef = {
  key: SectionKey;
  /** Nombre por defecto; el operador puede cambiarlo. */
  title: string;
  subtitle?: string;
  /**
   * Cuántos productos se ven A LA VEZ en esa sección. Si hay más, la tienda
   * los rota sola en carrusel; no es un tope de cuántos se pueden agregar.
   */
  limit: number;
  /** Explicación para el panel: dónde queda y para qué sirve. */
  hint: string;
};

/** Tope de productos por sección. Alto a propósito: el límite real es el diseño. */
export const MAX_SECTION_ITEMS = 20;

export const SECTIONS: SectionDef[] = [
  {
    key: "top_categorias",
    title: "Top Categorías",
    limit: 8,
    hint: "Los accesos redondos del hero. Se arman con tus categorías, no con productos.",
  },
  {
    key: "mejor_semana",
    title: "La mejor elección de la semana",
    limit: 4,
    hint: "Fila compacta debajo del hero. Se ven 4 a la vez; si agregas más, rotan solas.",
  },
  {
    key: "ofertas",
    title: "Ofertas que están encendidas",
    limit: 4,
    hint: "Panel oscuro destacado. Se ven 4 a la vez; si agregas más, rotan solas.",
  },
  {
    key: "destacados",
    title: "Productos destacados",
    limit: 6,
    hint: "La parrilla grande del centro. Se ven 6 a la vez; si agregas más, rotan solas.",
  },
  {
    key: "mejor_valorados",
    title: "Mejor valorados",
    limit: 4,
    hint: "Columna angosta a la izquierda de los destacados.",
  },
];

export const BANNER_SLOTS: {
  slot: BannerSlot;
  title: string;
  hint: string;
  /** Proporción sugerida de la pieza, para orientar el diseño. */
  ratio: string;
}[] = [
  {
    slot: "hero_principal",
    title: "Banner principal del hero",
    hint: "El espacio grande de la izquierda, lo primero que ve el visitante.",
    ratio: "Horizontal · aprox. 1200 × 800 px",
  },
  {
    slot: "hero_lateral",
    title: "Banner lateral del hero",
    hint: "El bloque vertical junto al principal.",
    ratio: "Vertical · aprox. 700 × 900 px",
  },
  {
    slot: "promo_secundaria",
    title: "Promo de la parrilla",
    hint: "Pieza alta a la izquierda de los productos destacados.",
    ratio: "Vertical · aprox. 600 × 1000 px",
  },
];

export const RULE_LABEL: Record<string, string> = {
  BEST_SELLERS: "Más vendidos",
  NEWEST: "Agregados recientemente",
  ONLINE_DEAL: "Con precio especial online",
  FEATURED: "Marcados como destacados",
};

export function sectionDef(key: string): SectionDef | undefined {
  return SECTIONS.find((s) => s.key === key);
}
