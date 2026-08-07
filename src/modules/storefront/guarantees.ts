// Las garantías que la tienda publica.
//
// Archivo de DATOS, sin JSX, para que las pruebas puedan importarlo: Vitest
// corre en entorno `node` y no transforma componentes. El componente que las
// pinta vive en `product-guarantees.tsx`.
//
// UNA lista, consumida por el home y por la ficha de producto. Se comparte el
// CONTENIDO, no la maqueta: cada pantalla lo pinta a su tamaño. Lo que no
// puede divergir es qué se promete — el día que cambie una promesa comercial,
// que es cosa del cliente y no nuestra, quedaría corregida en una pantalla y
// viva en la otra. Y la que se olvidaría es la de la ficha, que es la que se
// lee justo antes de comprar.
//
// Son TRES y no las del prototipo. El prototipo promete compra protegida,
// envíos rápidos y devoluciones a 7 días: exactamente lo que se decidió no
// publicar porque el negocio no lo sostiene
// (ver ../../../notas-tecnicas-privado.md §Tienda pública).

import { MessageCircle, Store, Truck } from "lucide-react";

export const GUARANTEES = [
  {
    icon: MessageCircle,
    title: "Atención por WhatsApp",
    text: "Confirmamos tu pedido y resolvemos tus dudas por chat.",
  },
  {
    icon: Store,
    title: "Tienda física y online",
    text: "El mismo inventario, sincronizado en los dos canales.",
  },
  {
    icon: Truck,
    title: "Envíos a todo el país",
    text: "Coordinamos el envío contigo al confirmar el pedido.",
  },
] as const;
