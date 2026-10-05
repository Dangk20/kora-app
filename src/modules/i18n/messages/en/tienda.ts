import type { tienda as es } from "../es/tienda";

export const tienda: typeof es = {
  meta: {
    titulo: "Everything you want, in one place",
    descripcion:
      "KORA online store. Shop online and finish your order over WhatsApp, with the same inventory as our physical store.",
    lema: "Everything you want, in one place",
    en: "at",
    ogLocale: "en_US",
  },
  cargandoCatalogo: "We're loading our catalog",
  muyPronto: "Soon you'll find all of our products right here.",
  verTodo: "View all",
  verMas: "See more",
  verProducto: "View product",
  // Mismo orden que GUARANTEES: el ícono sale de allí por posición.
  garantias: [
    {
      title: "WhatsApp support",
      text: "We confirm your order and answer your questions by chat.",
    },
    {
      title: "In-store and online",
      text: "The same inventory, synced across both channels.",
    },
    {
      title: "Shipping nationwide in Colombia",
      text: "We arrange shipping with you when we confirm your order.",
    },
  ],
  franja: {
    tituloAntes: "KORA, everything in",
    tituloAcento: "one place",
    texto: "Browse the catalog, build your order, and we'll wrap it up together on WhatsApp.",
    boton: "Start shopping",
  },
  seccionVacia: "Use the pencil to add products. Empty sections aren't shown in the store.",
  banners: {
    principal: "Main banner — upload it from Showcase",
    lateral: "Side banner — upload it from Showcase",
    promo: "Grid promo — upload it from Showcase",
    verPieza: (i: number, total: number) => `View slide ${i} of ${total}`,
  },
  carrusel: {
    anterior: "Previous",
    siguiente: "Next",
    verPagina: (p: number, total: number) => `Go to page ${p} of ${total}`,
  },
};
