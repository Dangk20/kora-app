// Promociones, cupones y Kora Cashback (change `centro-legal`, 10 oct 2026).
//
// Las redes de tarjetas piden publicar "los términos y condiciones de
// cualquier promoción". Las reglas generales de los cupones y las de Kora
// Cashback salen de su comportamiento real; la tasa y la vigencia del cashback,
// de sus constantes.
//
// Las PROMOCIONES VIGENTES se listan en `PROMOCIONES` con su fecha de fin y
// desaparecen solas al vencer: la página es dinámica. No se leen de la tabla de
// cupones a propósito: muchos cupones son privados (se mandan a una persona o a
// una lista) y publicarlos todos sería regalar sus códigos. Aquí va solo lo que
// KORA anuncia en público. Al crear una campaña pública, se añade aquí.

import { TASA_CASHBACK, VIGENCIA_MESES } from "@/modules/cashback/money";
import { PREVALECE_ESPANOL } from "./common";
import type { BilingualDocument, LegalBlock, LegalSection } from "./types";

const ACTUALIZADO = "2026-10-10";
const PORCENTAJE_CASHBACK = `${Math.round(TASA_CASHBACK * 100)} %`;
const PERCENT_CASHBACK = `${Math.round(TASA_CASHBACK * 100)}%`;

type Promocion = {
  /** Hasta cuándo se publica (y se puede usar). */
  hasta: Date;
  es: { titulo: string; condiciones: string[] };
  en: { titulo: string; condiciones: string[] };
};

/**
 * Campañas anunciadas en público. Las cifras deben coincidir con el cupón
 * creado en el módulo de Cupones: este texto es lo que se le promete al
 * comprador; el cupón es lo que el sistema aplica.
 */
export const PROMOCIONES: readonly Promocion[] = [
  {
    // Cupón de apertura (5 oct 2026): ver src/modules/buyer/welcome-email.ts.
    hasta: new Date("2026-11-01T04:59:59Z"), // 31 oct, 11:59 p. m. Colombia
    es: {
      titulo: "Cupón de bienvenida BIENVENIDOSAKORA",
      condiciones: [
        "7 % de descuento en tu primera compra en la tienda en línea.",
        "Se puede usar una sola vez por cliente.",
        "Válido hasta el 31 de octubre de 2026 a las 11:59 p. m., hora de Colombia.",
        "No se combina con el pago con saldo de Kora Cashback.",
      ],
    },
    en: {
      titulo: "Welcome coupon BIENVENIDOSAKORA",
      condiciones: [
        "7% off your first purchase in the online store.",
        "Can be used only once per customer.",
        "Valid until October 31, 2026 at 11:59 p.m., Colombia time.",
        "Cannot be combined with paying with Kora Cashback balance.",
      ],
    },
  },
];

function vigentes(ahora: Date): Promocion[] {
  return PROMOCIONES.filter((p) => ahora < p.hasta);
}

function seccionVigentes(locale: "es" | "en", ahora: Date): LegalSection {
  const activas = vigentes(ahora);
  const blocks: LegalBlock[] =
    activas.length === 0
      ? [
          {
            kind: "p",
            text:
              locale === "es"
                ? "En este momento no hay promociones públicas vigentes. Cuando lancemos una, sus condiciones se publicarán aquí."
                : "There are no public promotions running right now. When we launch one, its terms will be published here.",
          },
        ]
      : activas.flatMap((p): LegalBlock[] => [
          { kind: "note", text: p[locale].titulo },
          { kind: "list", items: p[locale].condiciones },
        ]);

  return {
    id: "vigentes",
    heading: locale === "es" ? "Promociones vigentes" : "Current promotions",
    summary:
      locale === "es"
        ? "Las condiciones de cada promoción pública que está activa hoy."
        : "The terms of every public promotion running today.",
    blocks,
  };
}

export const promociones: BilingualDocument = {
  es: () => ({
    slug: "promociones",
    title: "Promociones, cupones y Kora Cashback",
    shortTitle: "Promociones y cashback",
    summary: "Las reglas de los cupones, las condiciones de las promociones vigentes y cómo funciona Kora Cashback.",
    updatedAt: ACTUALIZADO,
    sections: [
      seccionVigentes("es", new Date()),
      {
        id: "cupones",
        heading: "Reglas generales de los cupones",
        summary: "Cada cupón tiene vigencia, usos, monto mínimo y productos donde aplica, y se valida al crear el pedido.",
        blocks: [
          {
            kind: "list",
            items: [
              "Cada cupón tiene sus propias condiciones: fecha de vigencia, número máximo de usos (en total y por cliente), monto mínimo de compra, productos o categorías donde aplica, si es solo para la primera compra y si aplica o no a productos con precio especial.",
              "Las condiciones se validan al crear el pedido. Un cupón vencido, agotado o que no aplica a los productos del carrito no se acepta.",
              "Se aplica un cupón por pedido.",
              "No es posible combinar un cupón con el pago con saldo de Kora Cashback en la misma compra.",
              "Los cupones no son canjeables por dinero en efectivo.",
              "Si un pedido con cupón se cancela o vence, el uso del cupón puede no recuperarse.",
            ],
          },
        ],
      },
      {
        id: "cashback",
        heading: "Kora Cashback",
        summary: `Con cada compra confirmada acumulas el ${PORCENTAJE_CASHBACK} de lo que pagaste con dinero, para usarlo en tu próxima compra.`,
        blocks: [
          {
            kind: "p",
            text: `Con cada compra confirmada acumulas el ${PORCENTAJE_CASHBACK} del valor que efectivamente pagaste con dinero, después de descontar cupones y el propio saldo de cashback que hayas usado. Ese saldo lo puedes usar como descuento en tu próxima compra.`,
          },
          {
            kind: "list",
            items: [
              "El saldo se acredita cuando tu pedido se confirma, no cuando lo creas.",
              `Cada acreditación tiene una vigencia de ${VIGENCIA_MESES} meses. Al usarlo se consume primero el saldo más próximo a vencer.`,
              "El saldo en pesos y el saldo en dólares son independientes: no se suman entre sí ni se convierten el uno en el otro.",
              "Para acumular y usar cashback necesitas tener cuenta en la tienda y estar con la sesión iniciada al momento de comprar.",
              "El saldo es personal e intransferible, y no es canjeable por dinero en efectivo.",
            ],
          },
          {
            kind: "note",
            text: "Si usas saldo en un pedido y ese pedido se cancela o vence, el saldo vuelve a tu cuenta con la misma fecha de vencimiento que tenía. Cancelar un pedido no renueva la vigencia de un cashback por vencer.",
          },
        ],
      },
      {
        id: "cambios-promociones",
        heading: "Cambios y finalización",
        summary: "Una promoción se cumple en las condiciones publicadas mientras está vigente.",
        blocks: [
          {
            kind: "p",
            text: "Podemos crear, modificar o terminar promociones y cupones, pero una promoción publicada se cumple en las condiciones anunciadas durante su vigencia. Los cambios no afectan los pedidos ya creados ni el saldo de cashback ya acreditado.",
          },
        ],
      },
    ],
  }),

  en: () => ({
    slug: "promociones",
    title: "Promotions, Coupons and Kora Cashback",
    shortTitle: "Promotions and cashback",
    summary: "The rules for coupons, the terms of current promotions and how Kora Cashback works.",
    updatedAt: ACTUALIZADO,
    sections: [
      seccionVigentes("en", new Date()),
      {
        id: "cupones",
        heading: "General coupon rules",
        summary: "Each coupon has a validity period, usage limits, a minimum purchase and eligible products, checked when the order is placed.",
        blocks: [
          {
            kind: "list",
            items: [
              "Each coupon has its own terms: validity dates, maximum number of uses (overall and per customer), minimum purchase amount, the products or categories it applies to, whether it is for first purchases only and whether it applies to items on special price.",
              "Terms are checked when the order is placed. An expired or used-up coupon, or one that does not apply to the products in the cart, is not accepted.",
              "One coupon applies per order.",
              "A coupon cannot be combined with paying with Kora Cashback balance in the same purchase.",
              "Coupons cannot be exchanged for cash.",
              "If an order with a coupon is cancelled or expires, the coupon use may not be restored.",
            ],
          },
          { kind: "note", text: PREVALECE_ESPANOL },
        ],
      },
      {
        id: "cashback",
        heading: "Kora Cashback",
        summary: `With every confirmed purchase you earn ${PERCENT_CASHBACK} of what you paid with money, to use on your next purchase.`,
        blocks: [
          {
            kind: "p",
            text: `With every confirmed purchase you earn ${PERCENT_CASHBACK} of the amount you actually paid with money, after deducting coupons and any cashback balance you used. You can use that balance as a discount on your next purchase.`,
          },
          {
            kind: "list",
            items: [
              "The balance is credited when your order is confirmed, not when you place it.",
              `Each credit is valid for ${VIGENCIA_MESES} months. When you use it, the balance closest to expiring is used first.`,
              "Peso balance and dollar balance are separate: they are not added together or converted into each other.",
              "To earn and use cashback you need a store account and must be signed in when you buy.",
              "The balance is personal and non-transferable, and cannot be exchanged for cash.",
            ],
          },
          {
            kind: "note",
            text: "If you use balance on an order and that order is cancelled or expires, the balance returns to your account with the same expiration date it had. Cancelling an order does not renew the validity of cashback about to expire.",
          },
        ],
      },
      {
        id: "cambios-promociones",
        heading: "Changes and termination",
        summary: "A promotion is honored on its published terms while it runs.",
        blocks: [
          {
            kind: "p",
            text: "We may create, change or end promotions and coupons, but a published promotion is honored on its announced terms while it runs. Changes do not affect orders already placed or cashback already credited.",
          },
        ],
      },
    ],
  }),
};
