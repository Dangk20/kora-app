// Seguridad de pagos y transmisión de datos de tarjeta (change `centro-legal`).
//
// El punto de la lista del banco que más se presta a prometer de más. Lo que
// se publica es lo que el diseño garantiza: con pago alojado, la tarjeta se
// escribe en la página del procesador y KORA solo recibe el resultado. No se
// afirma 3-D Secure, ni tokenización, ni certificaciones propias: no constan.

import {
  cobroTarjetaEn,
  cobroTarjetaEs,
  MARCAS_EN,
  MARCAS_ES,
  MONEDAS_TARJETA_EN,
  MONEDAS_TARJETA_ES,
  PREVALECE_ESPANOL,
} from "./common";
import { transferenciasDe } from "../payments";
import type { BilingualDocument } from "./types";

const ACTUALIZADO = "2026-10-10";

export const seguridadPagos: BilingualDocument = {
  es: (m) => ({
    slug: "seguridad-pagos",
    title: "Seguridad de pagos",
    shortTitle: "Seguridad de pagos",
    summary: "Cómo protegemos tu pago con tarjeta: los datos de tu tarjeta nunca pasan por KORA.",
    updatedAt: ACTUALIZADO,
    sections: [
      {
        id: "pago-alojado",
        heading: "Tu tarjeta se escribe en la página del procesador",
        summary: "KORA no recibe, no ve y no almacena el número, la fecha de vencimiento ni el código de seguridad de tu tarjeta.",
        blocks: [
          {
            kind: "p",
            text: "Cuando eliges pagar con tarjeta, te llevamos a la página de pago segura de nuestro procesador de pagos. Ahí escribes los datos de tu tarjeta, y el procesador los transmite a la red de tarjetas y a tu banco para autorizar el cobro.",
          },
          {
            kind: "p",
            text: "KORA no recibe, no ve y no almacena el número de tu tarjeta, su fecha de vencimiento ni su código de seguridad. Lo único que recibimos del procesador es el resultado de la operación (aprobada o rechazada), su referencia y su valor, para confirmar tu pedido.",
          },
          {
            kind: "p",
            text: "El procesador de pagos está obligado a cumplir el estándar de seguridad de datos de la industria de tarjetas de pago (PCI DSS), que fijan Visa, Mastercard y American Express para quien trata datos de tarjetas.",
          },
        ],
      },
      {
        id: "transmision",
        heading: "Transmisión cifrada",
        summary: "Toda la comunicación con la tienda y con la página de pago viaja cifrada.",
        blocks: [
          {
            kind: "list",
            items: [
              "Toda la tienda se sirve únicamente por conexión cifrada (HTTPS, con TLS). El candado de tu navegador lo confirma.",
              "La página de pago del procesador también usa conexión cifrada, independiente de la de KORA.",
              "Ningún formulario de la tienda pide datos de tarjeta. Si alguna vez te los piden por WhatsApp, correo o teléfono en nombre de KORA, no los entregues y repórtalo.",
            ],
          },
        ],
      },
      {
        id: "marcas-y-monedas",
        heading: "Tarjetas y monedas aceptadas",
        summary: `Aceptamos ${MARCAS_ES}, en ${MONEDAS_TARJETA_ES}.`,
        blocks: [
          {
            kind: "p",
            text: `Aceptamos tarjetas de crédito y débito ${MARCAS_ES}. El cobro se hace en la moneda de tu pedido: ${MONEDAS_TARJETA_ES}.`,
          },
          { kind: "p", text: cobroTarjetaEs(m) },
          {
            kind: "p",
            text: `También recibimos transferencias, coordinadas por WhatsApp: en Colombia, ${transferenciasDe("CO", "y")} (en pesos); desde Estados Unidos, ${transferenciasDe("US", "y")} (en dólares). Las haces desde tu propio banco o billetera, y KORA nunca te pide tus claves, códigos de verificación ni datos de acceso.`,
          },
        ],
      },
      {
        id: "fraude",
        heading: "Prevención de fraude",
        summary: "Podemos verificar un pedido antes de despacharlo, y nunca te pediremos tu tarjeta por chat.",
        blocks: [
          {
            kind: "p",
            text: "Para protegerte, podemos contactarte para verificar un pedido antes de despacharlo, o cancelarlo con reembolso completo si el pago presenta señales de fraude.",
          },
          {
            kind: "p",
            text: `Si ves en tu extracto un cobro de KORA que no reconoces, escríbenos a ${m.email} antes de iniciar un contracargo: lo revisamos de inmediato.`,
          },
        ],
      },
    ],
  }),

  en: (m) => ({
    slug: "seguridad-pagos",
    title: "Payment Security",
    shortTitle: "Payment security",
    summary: "How we protect your card payment: your card details never pass through KORA.",
    updatedAt: ACTUALIZADO,
    sections: [
      {
        id: "pago-alojado",
        heading: "You enter your card on the processor's page",
        summary: "KORA does not receive, see or store your card number, expiration date or security code.",
        blocks: [
          {
            kind: "p",
            text: "When you choose to pay by card, we take you to our payment processor's secure payment page. There you enter your card details, and the processor sends them to the card network and your bank to authorize the charge.",
          },
          {
            kind: "p",
            text: "KORA does not receive, see or store your card number, expiration date or security code. The only thing we receive from the processor is the result of the transaction (approved or declined), its reference and its amount, to confirm your order.",
          },
          {
            kind: "p",
            text: "The payment processor is required to comply with the Payment Card Industry Data Security Standard (PCI DSS), set by Visa, Mastercard and American Express for anyone who handles card data.",
          },
          { kind: "note", text: PREVALECE_ESPANOL },
        ],
      },
      {
        id: "transmision",
        heading: "Encrypted transmission",
        summary: "All communication with the store and the payment page is encrypted.",
        blocks: [
          {
            kind: "list",
            items: [
              "The whole store is served only over an encrypted connection (HTTPS, with TLS). The padlock in your browser confirms it.",
              "The processor's payment page also uses an encrypted connection, separate from KORA's.",
              "No form in the store asks for card details. If anyone ever asks for them through WhatsApp, email or phone on behalf of KORA, do not give them and report it.",
            ],
          },
        ],
      },
      {
        id: "marcas-y-monedas",
        heading: "Accepted cards and currencies",
        summary: `We accept ${MARCAS_EN}, in ${MONEDAS_TARJETA_EN}.`,
        blocks: [
          { kind: "p", text: `We accept ${MARCAS_EN} credit and debit cards. The charge is made in the currency of your order: ${MONEDAS_TARJETA_EN}.` },
          { kind: "p", text: cobroTarjetaEn(m) },
          {
            kind: "p",
            text: `We also accept bank transfers, arranged through WhatsApp: ${transferenciasDe("CO", "and")} in Colombia (in pesos), and ${transferenciasDe("US", "and")} from the United States (in dollars). You send them from your own bank or wallet, and KORA never asks for your passwords, verification codes or login details.`,
          },
        ],
      },
      {
        id: "fraude",
        heading: "Fraud prevention",
        summary: "We may verify an order before shipping it, and we will never ask for your card through chat.",
        blocks: [
          { kind: "p", text: "To protect you, we may contact you to verify an order before shipping it, or cancel it with a full refund if the payment shows signs of fraud." },
          { kind: "p", text: `If you see a KORA charge on your statement that you do not recognize, write to ${m.email} before starting a chargeback: we will review it right away.` },
        ],
      },
    ],
  }),
};
