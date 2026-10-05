// Diccionarios de la tienda. `es` define la forma; `en` debe cumplirla, así
// que una clave sin traducir NO compila. Un archivo por área para que dos
// áreas se puedan traducir sin pisarse.
import { comun as comunEs } from "./es/comun";
import { comun as comunEn } from "./en/comun";
import { layout as layoutEs } from "./es/layout";
import { layout as layoutEn } from "./en/layout";
import { tienda as tiendaEs } from "./es/tienda";
import { tienda as tiendaEn } from "./en/tienda";
import { catalogo as catalogoEs } from "./es/catalogo";
import { catalogo as catalogoEn } from "./en/catalogo";
import { producto as productoEs } from "./es/producto";
import { producto as productoEn } from "./en/producto";
import { carrito as carritoEs } from "./es/carrito";
import { carrito as carritoEn } from "./en/carrito";
import { checkout as checkoutEs } from "./es/checkout";
import { checkout as checkoutEn } from "./en/checkout";
import { cuenta as cuentaEs } from "./es/cuenta";
import { cuenta as cuentaEn } from "./en/cuenta";
import { pedido as pedidoEs } from "./es/pedido";
import { pedido as pedidoEn } from "./en/pedido";
import { buscador as buscadorEs } from "./es/buscador";
import { buscador as buscadorEn } from "./en/buscador";
import { errores as erroresEs } from "./es/errores";
import { errores as erroresEn } from "./en/errores";
import { movil as movilEs } from "./es/movil";
import { movil as movilEn } from "./en/movil";

const es = {
  comun: comunEs,
  layout: layoutEs,
  tienda: tiendaEs,
  catalogo: catalogoEs,
  producto: productoEs,
  carrito: carritoEs,
  checkout: checkoutEs,
  cuenta: cuentaEs,
  pedido: pedidoEs,
  buscador: buscadorEs,
  errores: erroresEs,
  movil: movilEs,
};

export type Messages = typeof es;

const en: Messages = {
  comun: comunEn,
  layout: layoutEn,
  tienda: tiendaEn,
  catalogo: catalogoEn,
  producto: productoEn,
  carrito: carritoEn,
  checkout: checkoutEn,
  cuenta: cuentaEn,
  pedido: pedidoEn,
  buscador: buscadorEn,
  errores: erroresEn,
  movil: movilEn,
};

export const MESSAGES: Record<"es" | "en", Messages> = { es, en };
