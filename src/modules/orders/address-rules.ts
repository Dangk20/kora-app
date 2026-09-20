// Qué exige cada país de una dirección y de un contacto. UNA definición.
//
// Ver openspec/changes/direccion-facturacion-y-envio — specs/checkout-addresses.
//
// Vivía inline en `createOrder` como un `if (country === "CO") … else …`. Con
// dos bloques en el checkout —quien paga, en CO o en US, y a quién se envía,
// siempre en Colombia— habría que duplicarlo, y dos copias divergen a la
// primera columna nueva: la misma lección que `sale-fields.tsx`. Aquí no hay
// Zod ni base de datos a propósito: se prueba con la lógica real.

import { ciudadCanonica } from "@/modules/geo/places";
import { toE164, type Country } from "@/modules/customers/phone";

export type Rechazo = { ok: false; field: string; error: string };

export type DireccionEntrada = {
  state: string;
  city: string;
  neighborhood?: string | null;
  zip?: string | null;
};

/**
 * Valida una dirección según su país y devuelve la ciudad CANÓNICA ("NEIVA" →
 * "Neiva"). El navegador ya impide casi todo con los desplegables cerrados;
 * esto es para quien no pasa por él. Una dirección "Medellín, Huila" es un
 * paquete perdido.
 */
export function validarDireccion(
  pais: Country,
  d: DireccionEntrada,
): { ok: true; city: string } | Rechazo {
  if (pais === "CO") {
    if (!d.neighborhood?.trim()) {
      return { ok: false, field: "neighborhood", error: "Escribe el barrio" };
    }
    const canonica = ciudadCanonica("CO", d.state, d.city);
    if (!canonica) {
      return { ok: false, field: "city", error: "Elige un municipio del departamento seleccionado" };
    }
    return { ok: true, city: canonica };
  }
  if (!/^\d{5}(-\d{4})?$/.test(d.zip ?? "")) {
    return { ok: false, field: "zip", error: "ZIP inválido (##### o #####-####)" };
  }
  const canonica = ciudadCanonica("US", d.state, d.city);
  if (!canonica) {
    return { ok: false, field: "city", error: "Choose a city in the selected state" };
  }
  return { ok: true, city: canonica };
}

export type ContactoEntrada = {
  phone: string;
  document?: string | null;
};

/**
 * Valida el contacto según su país y devuelve el teléfono en E.164.
 *
 * `documentoObligatorio`: en Colombia lo exigen las transportadoras para quien
 * paga (PED_HU001 §2). Para el DESTINATARIO es opcional: quien compra desde
 * fuera no siempre tiene la cédula del familiar a mano, y exigirla perdería la
 * venta. En EE.UU. nunca se pide.
 */
export function validarContacto(
  pais: Country,
  c: ContactoEntrada,
  opciones: { documentoObligatorio: boolean },
): { ok: true; phone: string } | Rechazo {
  if (pais === "CO") {
    if (opciones.documentoObligatorio && (c.document ?? "").replace(/\D/g, "").length < 5) {
      return { ok: false, field: "document", error: "Escribe tu número de documento" };
    }
    if (c.phone.replace(/\D/g, "").replace(/^57/, "").length !== 10) {
      return { ok: false, field: "phone", error: "El celular debe tener 10 dígitos" };
    }
  }
  return { ok: true, phone: toE164(c.phone, pais) };
}
