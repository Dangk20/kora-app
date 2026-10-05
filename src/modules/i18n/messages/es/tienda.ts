// Área "tienda": portada y piezas compartidas de la vitrina. `en/tienda.ts`
// debe tener exactamente la misma forma.
import { GUARANTEES } from "@/modules/storefront/guarantees";

export const tienda = {
  meta: {
    titulo: "Todo lo que quieres, en un solo lugar",
    descripcion:
      "Tienda online KORA. Compra en línea y coordina tu pedido por WhatsApp, con el mismo inventario de nuestra tienda física.",
    /** Lema que completa la descripción de una ficha sin descripción propia. */
    lema: "Todo lo que quieres, en un solo lugar",
    /** "Camisetas en KORA": une la categoría con la marca en esa descripción. */
    en: "en",
    /** Para `openGraph.locale`. */
    ogLocale: "es_CO",
  },
  cargandoCatalogo: "Estamos cargando el catálogo",
  muyPronto: "Muy pronto vas a encontrar aquí todos nuestros productos.",
  verTodo: "Ver todo",
  verMas: "Ver más",
  /** Botón que aparece al pasar el cursor sobre un banner con enlace. */
  verProducto: "Ver producto",
  /** Las garantías salen de la MISMA lista que fijan las pruebas (guarantees.ts). */
  garantias: GUARANTEES.map(({ title, text }): { title: string; text: string } => ({ title, text })),
  franja: {
    tituloAntes: "KORA, todo en un",
    tituloAcento: "solo lugar",
    texto: "Explora el catálogo, arma tu pedido y lo cerramos juntos por WhatsApp.",
    boton: "Empieza a comprar",
  },
  /** Solo se ven en la vista previa de Vitrina o con un espacio sin pieza. */
  seccionVacia: "Usa el lápiz para agregar productos. Vacía, no se muestra en la tienda.",
  banners: {
    principal: "Banner principal — cárgalo desde Vitrina",
    lateral: "Banner lateral — cárgalo desde Vitrina",
    promo: "Promo de la parrilla — cárgala desde Vitrina",
    verPieza: (i: number, total: number) => `Ver pieza ${i} de ${total}`,
  },
  carrusel: {
    anterior: "Anterior",
    siguiente: "Siguiente",
    verPagina: (p: number, total: number) => `Ver página ${p} de ${total}`,
  },
};
