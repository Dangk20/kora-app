// Información del comercio y contacto (change `centro-legal`, 10 oct 2026).
//
// Responde a dos puntos de la lista de las redes de tarjetas: "información de
// contacto de atención al cliente, con correo o teléfono" y "la dirección
// física del negocio, incluido el país del establecimiento". KORA opera en dos
// países (Daniel, 10 oct): la matriz en EE.UU., que procesa los cobros con
// tarjeta, y su sociedad en Colombia, que vende y entrega. Se publican las dos
// con sus registros, y todo sale del entorno: ningún dato va escrito aquí.

import { cobroTarjetaEn, cobroTarjetaEs, PREVALECE_ESPANOL } from "./common";
import type { BilingualDocument } from "./types";

const ACTUALIZADO = "2026-10-10";

/** `+573024456290` → `+57 302 445 6290`. */
function telefono(e164: string): string {
  const co = e164.match(/^\+57(\d{3})(\d{3})(\d{4})$/);
  return co ? `+57 ${co[1]} ${co[2]} ${co[3]}` : e164;
}

export const comercio: BilingualDocument = {
  es: (m, ctx) => ({
    slug: "comercio",
    title: "Información del comercio y contacto",
    shortTitle: "Información del comercio",
    summary: "Quiénes somos en cada país, dónde estamos y cómo comunicarte con nosotros.",
    updatedAt: ACTUALIZADO,
    sections: [
      {
        id: "matriz",
        heading: "Estados Unidos — sociedad matriz",
        summary: `${m.llc.razonSocial}, que procesa los pagos con tarjeta.`,
        blocks: [
          {
            kind: "list",
            items: [
              `Razón social: ${m.llc.razonSocial}`,
              "Nombre comercial: KORA",
              `Registro: ${m.llc.registro}`,
              `Dirección física: ${m.llc.domicilio}`,
              "País: Estados Unidos",
            ],
          },
          { kind: "p", text: cobroTarjetaEs(m) },
        ],
      },
      {
        id: "colombia",
        heading: "Colombia — operación de venta y entrega",
        summary: `${m.razonSocial}, que vende, entrega y atiende en Colombia.`,
        blocks: [
          {
            kind: "list",
            items: [
              `Razón social: ${m.razonSocial}`,
              "Nombre comercial: KORA",
              `NIT: ${m.nit}`,
              `Registro: ${m.matricula}`,
              `Dirección física: ${m.domicilio}`,
              "País: Colombia",
            ],
          },
          {
            kind: "p",
            text: `${m.razonSocial} es la responsable del tratamiento de tus datos personales y de la atención de cambios, garantías y reclamaciones.`,
          },
        ],
      },
      {
        id: "contacto",
        heading: "Atención al cliente",
        summary: "Escríbenos por correo o por WhatsApp.",
        blocks: [
          {
            kind: "list",
            items: [
              `Correo electrónico: ${m.email}`,
              ...(ctx?.whatsapp ? [`WhatsApp y teléfono: ${telefono(ctx.whatsapp)}`] : ["WhatsApp: desde el botón de cualquier página de la tienda."]),
              "Tienda en línea: korashopp.com",
            ],
          },
          {
            kind: "p",
            text: `Para peticiones, quejas, reclamos, solicitudes sobre tus datos personales, cambios, garantías y retracto, escríbenos a ${m.email} con tu número de pedido cuando lo tengas.`,
          },
        ],
      },
    ],
  }),

  en: (m, ctx) => ({
    slug: "comercio",
    title: "Merchant Information and Contact",
    shortTitle: "Merchant information",
    summary: "Who we are in each country, where we are and how to reach us.",
    updatedAt: ACTUALIZADO,
    sections: [
      {
        id: "matriz",
        heading: "United States — parent company",
        summary: `${m.llc.razonSocial}, which processes card payments.`,
        blocks: [
          {
            kind: "list",
            items: [
              `Legal name: ${m.llc.razonSocial}`,
              "Trade name: KORA",
              `Registration: ${m.llc.registro}`,
              `Physical address: ${m.llc.domicilio}`,
              "Country: United States",
            ],
          },
          { kind: "p", text: cobroTarjetaEn(m) },
          { kind: "note", text: PREVALECE_ESPANOL },
        ],
      },
      {
        id: "colombia",
        heading: "Colombia — sales and delivery operation",
        summary: `${m.razonSocial}, which sells, delivers and provides customer service in Colombia.`,
        blocks: [
          {
            kind: "list",
            items: [
              `Legal name: ${m.razonSocial}`,
              "Trade name: KORA",
              `Tax ID (NIT): ${m.nit}`,
              `Registration: ${m.matricula}`,
              `Physical address: ${m.domicilio}`,
              "Country: Colombia",
            ],
          },
          {
            kind: "p",
            text: `${m.razonSocial} is the controller of your personal data and handles exchanges, warranties and claims.`,
          },
        ],
      },
      {
        id: "contacto",
        heading: "Customer service",
        summary: "Write to us by email or WhatsApp.",
        blocks: [
          {
            kind: "list",
            items: [
              `Email: ${m.email}`,
              ...(ctx?.whatsapp ? [`WhatsApp and phone: ${telefono(ctx.whatsapp)}`] : ["WhatsApp: from the button on any page of the store."]),
              "Online store: korashopp.com",
            ],
          },
          {
            kind: "p",
            text: `For requests, complaints, claims, personal data requests, exchanges, warranties and withdrawals, write to ${m.email} with your order number when you have it.`,
          },
        ],
      },
    ],
  }),
};
