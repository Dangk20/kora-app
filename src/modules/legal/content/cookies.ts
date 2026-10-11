// Política de cookies (change `medicion-publicitaria`, 11 oct 2026).
//
// Estructura tomada de la política de cookies de Panamericana (referencia que
// pidió Daniel), adaptada a lo que KORA hace de verdad. La diferencia que no se
// negocia: aquí aceptar NO es implícito. Las cookies opcionales solo se activan
// con "Aceptar"; "Solo necesarias" las deja apagadas. Ley 1581 de
// 2012: la autorización es previa, expresa e informada.
//
// No nombra proveedores, a pedido de Daniel ("no nombremos plataformas"): se
// describen por su finalidad —analítica, publicidad, experiencia de uso—.

import { PREVALECE_ESPANOL } from "./common";
import type { BilingualDocument } from "./types";

const ACTUALIZADO = "2026-10-11";

export const cookies: BilingualDocument = {
  es: (m, c) => ({
    slug: "cookies",
    title: "Política de cookies",
    shortTitle: "Política de cookies",
    summary: "Qué son las cookies, cuáles usamos, para qué y cómo puedes aceptarlas, rechazarlas o borrarlas.",
    updatedAt: ACTUALIZADO,
    sections: [
      {
        id: "que-son",
        heading: "¿Qué son las cookies?",
        summary: "Pequeños archivos que el sitio guarda en tu navegador para recordar información de tu visita.",
        blocks: [
          {
            kind: "p",
            text: "Las cookies son pequeños archivos de texto que un sitio web guarda en tu navegador cuando lo visitas. Sirven para recordar información de tu visita —por ejemplo, la moneda o el idioma que elegiste, o los productos de tu carrito— y para entender cómo se usa el sitio.",
          },
          {
            kind: "p",
            text: "Una cookie se asocia a un identificador de tu navegador o dispositivo, no a tu nombre. Por sí sola no permite saber quién eres.",
          },
        ],
      },
      {
        id: "tipos",
        heading: "Tipos de cookies",
        summary: "Se clasifican por quién las pone, por cuánto duran y por su finalidad.",
        blocks: [
          {
            kind: "list",
            items: [
              "Según quién las gestiona: propias, que pone KORA, y de terceros, que ponen proveedores que nos prestan servicios.",
              "Según su duración: de sesión, que se borran al cerrar el navegador, y persistentes, que permanecen un tiempo determinado.",
              "Según su finalidad: necesarias, funcionales, de análisis y de publicidad.",
            ],
          },
        ],
      },
      {
        id: "que-usamos",
        heading: "Cookies que usamos",
        summary: "Las necesarias siempre; las de análisis y publicidad, solo si las aceptas.",
        blocks: [
          {
            kind: "list",
            items: [
              "Necesarias: hacen que la tienda funcione. Mantienen tu sesión iniciada, conservan tu carrito, recuerdan tu elección sobre cookies y protegen las transacciones. No se pueden desactivar desde la tienda.",
              "Funcionales: recuerdan tus preferencias, como la moneda y el idioma, y la campaña o enlace por el que llegaste a la tienda.",
              "De análisis: nos permiten medir cuántas personas visitan la tienda, qué páginas recorren, qué productos ven y dónde se atasca una compra, para mejorarla.",
              "De publicidad: nos permiten saber qué anuncios llevan a una compra y mostrarte publicidad de KORA más relevante en otros sitios y redes sociales.",
            ],
          },
          {
            kind: "note",
            text: "Las cookies de análisis y de publicidad son opcionales. Solo se activan si eliges «Aceptar» en el aviso de cookies.",
          },
        ],
      },
      {
        id: "finalidades",
        heading: "Para qué las usamos",
        summary: "Para que la tienda funcione, recordar tus preferencias, mejorarla y medir nuestra publicidad.",
        blocks: [
          {
            kind: "list",
            items: [
              "Hacer posible la compra: sesión, carrito, pedido y seguridad.",
              "Recordar tus preferencias para que no tengas que elegirlas cada vez.",
              "Entender cómo se usa la tienda y mejorar su diseño, sus contenidos y su catálogo.",
              "Medir qué campañas y anuncios funcionan y personalizar la publicidad de KORA.",
            ],
          },
        ],
      },
      {
        id: "terceros",
        heading: "Cookies de terceros",
        summary: "Si las aceptas, proveedores aliados de analítica y publicidad reciben información de tu navegación.",
        blocks: [
          {
            kind: "p",
            text: "Si aceptas las cookies opcionales, aliados que nos prestan servicios de analítica, publicidad y mejora de la experiencia reciben información sobre tu navegación en la tienda, únicamente para las finalidades descritas en esta política. Algunos de ellos están fuera de Colombia, principalmente en Estados Unidos.",
          },
          {
            kind: "p",
            text: "Cuando confirmamos un pedido de un comprador que aceptó estas cookies, informamos a esos aliados que la compra ocurrió y por qué valor, para medir la publicidad. Los datos de contacto que enviamos para ello —correo, teléfono, nombre y ciudad— van cifrados de forma irreversible. Las grabaciones de navegación ocultan lo que escribes en los formularios.",
          },
        ],
      },
      {
        id: "consentimiento",
        heading: "Cómo das o retiras tu consentimiento",
        summary: "«Aceptar» activa las opcionales; «Solo necesarias» las deja apagadas. Puedes cambiarlo cuando quieras.",
        blocks: [
          {
            kind: "list",
            items: [
              "Al pulsar «Aceptar» en el aviso de cookies autorizas las cookies opcionales de análisis y publicidad.",
              "Si eliges «Solo necesarias», solo usamos las cookies necesarias. No activamos ninguna opcional sin tu aceptación.",
              "Puedes cambiar tu elección en cualquier momento desde «Preferencias de cookies», al pie de la tienda. Si retiras tu aceptación, borramos las cookies de nuestros aliados de tu navegador.",
              "Tu elección se recuerda durante seis meses; después te lo volvemos a preguntar.",
            ],
          },
        ],
      },
      {
        id: "navegador",
        heading: "Cómo configurarlas desde tu navegador",
        summary: "También puedes bloquear o borrar cookies desde la configuración de tu navegador.",
        blocks: [
          {
            kind: "list",
            items: [
              "Chrome: Configuración → Privacidad y seguridad → Cookies de terceros.",
              "Safari (Mac): Ajustes → Privacidad → Gestionar datos de sitios web.",
              "Safari (iPhone y iPad): Ajustes → Safari → Avanzado → Datos de sitios web.",
              "Firefox: Ajustes → Privacidad y seguridad → Cookies y datos del sitio.",
              "Edge: Configuración → Cookies y permisos del sitio.",
            ],
          },
        ],
      },
      {
        id: "consecuencias",
        heading: "Qué pasa si las deshabilitas",
        summary: "Las opcionales no afectan tu compra; bloquear las necesarias sí.",
        blocks: [
          {
            kind: "p",
            text: "Rechazar las cookies opcionales no afecta tu compra: la tienda funciona igual. Si bloqueas desde tu navegador también las necesarias, no podremos mantener tu sesión, tu carrito ni tus preferencias, y algunas funciones de la tienda pueden dejar de funcionar.",
          },
        ],
      },
      {
        id: "contacto",
        heading: "Contacto y actualizaciones",
        summary: "Escríbenos por cualquier duda. Esta política puede cambiar; la fecha de arriba indica la última versión.",
        blocks: [
          {
            kind: "p",
            text: `Si tienes preguntas sobre esta política, escríbenos a ${m.email}${c?.whatsapp ? ` o por WhatsApp al ${c.whatsapp}` : " o por WhatsApp desde el botón de cualquier página de la tienda"}.`,
          },
          {
            kind: "p",
            text: "Podemos actualizar esta política por cambios en la tienda, en la ley o por instrucciones de la Superintendencia de Industria y Comercio. Te recomendamos revisarla periódicamente. El tratamiento de tus datos personales se rige por nuestra política de privacidad y tratamiento de datos personales.",
          },
        ],
      },
    ],
  }),

  en: (m, c) => ({
    slug: "cookies",
    title: "Cookie policy",
    shortTitle: "Cookie policy",
    summary: "What cookies are, which ones we use, why, and how you can accept, reject or delete them.",
    updatedAt: ACTUALIZADO,
    sections: [
      {
        id: "que-son",
        heading: "What are cookies?",
        summary: "Small files the site stores in your browser to remember information about your visit.",
        blocks: [
          {
            kind: "p",
            text: "Cookies are small text files a website stores in your browser when you visit it. They remember information about your visit —for example, the currency or language you chose, or the products in your cart— and help understand how the site is used.",
          },
          {
            kind: "p",
            text: "A cookie is tied to an identifier of your browser or device, not to your name. On its own it does not reveal who you are.",
          },
        ],
      },
      {
        id: "tipos",
        heading: "Types of cookies",
        summary: "They are classified by who sets them, how long they last and their purpose.",
        blocks: [
          {
            kind: "list",
            items: [
              "By who manages them: first-party, set by KORA, and third-party, set by providers that serve us.",
              "By duration: session cookies, deleted when you close the browser, and persistent cookies, which remain for a set time.",
              "By purpose: necessary, functional, analytics and advertising.",
            ],
          },
        ],
      },
      {
        id: "que-usamos",
        heading: "Cookies we use",
        summary: "Necessary ones always; analytics and advertising only if you accept them.",
        blocks: [
          {
            kind: "list",
            items: [
              "Necessary: they make the store work. They keep you signed in, keep your cart, remember your cookie choice and protect transactions. They cannot be turned off from the store.",
              "Functional: they remember your preferences, such as currency and language, and the campaign or link that brought you to the store.",
              "Analytics: they let us measure how many people visit the store, which pages they browse, which products they view and where a purchase gets stuck, so we can improve it.",
              "Advertising: they let us know which ads lead to a purchase and show you more relevant KORA ads on other sites and social networks.",
            ],
          },
          {
            kind: "note",
            text: "Analytics and advertising cookies are optional. They are only activated if you choose \"Accept\" in the cookie notice.",
          },
        ],
      },
      {
        id: "finalidades",
        heading: "Why we use them",
        summary: "To make the store work, remember your preferences, improve it and measure our advertising.",
        blocks: [
          {
            kind: "list",
            items: [
              "Making the purchase possible: session, cart, order and security.",
              "Remembering your preferences so you don't have to choose them every time.",
              "Understanding how the store is used and improving its design, content and catalog.",
              "Measuring which campaigns and ads work and personalizing KORA's advertising.",
            ],
          },
        ],
      },
      {
        id: "terceros",
        heading: "Third-party cookies",
        summary: "If you accept them, analytics and advertising partners receive information about your browsing.",
        blocks: [
          {
            kind: "p",
            text: "If you accept optional cookies, partners that provide us with analytics, advertising and experience-improvement services receive information about your browsing in the store, solely for the purposes described in this policy. Some of them are outside Colombia, mainly in the United States.",
          },
          {
            kind: "p",
            text: "When we confirm an order from a buyer who accepted these cookies, we tell those partners that the purchase happened and its value, to measure advertising. The contact details we send for this —email, phone, name and city— are irreversibly hashed. Browsing recordings hide what you type in forms.",
          },
        ],
      },
      {
        id: "consentimiento",
        heading: "How you give or withdraw consent",
        summary: "\"Accept\" activates optional cookies; \"Necessary only\" keeps them off. You can change it anytime.",
        blocks: [
          {
            kind: "list",
            items: [
              "By clicking \"Accept\" in the cookie notice you authorize optional analytics and advertising cookies.",
              "If you choose \"Necessary only\", we only use necessary cookies. We never activate optional cookies without your acceptance.",
              "You can change your choice at any time from \"Cookie preferences\" at the bottom of the store. If you withdraw your acceptance, we delete our partners' cookies from your browser.",
              "Your choice is remembered for six months; after that we ask again.",
            ],
          },
        ],
      },
      {
        id: "navegador",
        heading: "How to manage them in your browser",
        summary: "You can also block or delete cookies from your browser settings.",
        blocks: [
          {
            kind: "list",
            items: [
              "Chrome: Settings → Privacy and security → Third-party cookies.",
              "Safari (Mac): Settings → Privacy → Manage Website Data.",
              "Safari (iPhone and iPad): Settings → Safari → Advanced → Website Data.",
              "Firefox: Settings → Privacy & Security → Cookies and Site Data.",
              "Edge: Settings → Cookies and site permissions.",
            ],
          },
        ],
      },
      {
        id: "consecuencias",
        heading: "What happens if you disable them",
        summary: "Optional cookies don't affect your purchase; blocking necessary ones does.",
        blocks: [
          {
            kind: "p",
            text: "Rejecting optional cookies does not affect your purchase: the store works the same. If you also block necessary cookies from your browser, we won't be able to keep your session, cart or preferences, and some store features may stop working.",
          },
        ],
      },
      {
        id: "contacto",
        heading: "Contact and updates",
        summary: "Write to us with any question. This policy may change; the date above shows the latest version.",
        blocks: [
          {
            kind: "p",
            text: `If you have questions about this policy, write to ${m.email}${c?.whatsapp ? ` or via WhatsApp at ${c.whatsapp}` : " or via WhatsApp from the button on any page of the store"}.`,
          },
          {
            kind: "p",
            text: "We may update this policy due to changes in the store, in the law or instructions from Colombia's Superintendence of Industry and Commerce. We recommend reviewing it periodically. The processing of your personal data is governed by our privacy and personal data policy.",
          },
          { kind: "note", text: PREVALECE_ESPANOL },
        ],
      },
    ],
  }),
};
