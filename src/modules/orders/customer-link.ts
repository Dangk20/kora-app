// A qué cliente pertenece un pedido.
// Ver openspec/changes/cuenta-comprador — specs/buyer-account.
//
// Vive aparte de `checkout-actions.ts` porque es la decisión que hay que poder
// probar sola: la acción del checkout necesita una petición HTTP para leer la
// cookie, y esta regla no debería depender de eso para estar fijada.

import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export type OrderCustomerInput = {
  /** Cliente de la sesión del comprador, si hay sesión. */
  buyerCustomerId: string | null;
  name: string;
  email: string;
  phone: string;
  document?: string | null;
  country: string;
  city: string;
  address: string;
  acceptsMarketing: boolean;
};

/**
 * Reconoce o crea el cliente del pedido.
 *
 * CON SESIÓN es quien está dentro: la identidad ya está demostrada y buscar por
 * coincidencia sobra. Además estorba — un dedazo en el teléfono crearía un
 * cliente nuevo para alguien que ya está dentro, partiendo en dos su historial
 * y su saldo de cashback.
 *
 * SIN SESIÓN, cliente silencioso (PED_HU001 §4): coincidencia por correo o
 * teléfono, que es el mejor dato disponible cuando lo único que hay es lo que
 * alguien escribió en un formulario.
 */
export async function resolveOrderCustomer(tx: Tx, input: OrderCustomerInput) {
  const found = input.buyerCustomerId
    ? await tx.customer.findUnique({ where: { id: input.buyerCustomerId } })
    : await tx.customer.findFirst({
        where: { OR: [{ email: input.email }, { phone: input.phone }] },
      });

  if (!found) {
    return tx.customer.create({
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email,
        document: input.document ?? null,
        country: input.country,
        city: input.city,
        address: input.address,
        source: "WEB",
        acceptsMarketing: input.acceptsMarketing,
      },
    });
  }

  return tx.customer.update({
    where: { id: found.id },
    data: {
      name: input.name,
      phone: input.phone,
      // Con sesión, el correo es la CREDENCIAL de acceso: el checkout no lo
      // reescribe. Si lo hiciera, escribir otro correo aquí cambiaría —sin
      // avisar— con qué se entra a la cuenta, y podría chocar con el de otro
      // cliente. Cambiarlo se hace desde la cuenta, a propósito.
      ...(input.buyerCustomerId ? {} : { email: input.email }),
      document: input.document ?? found.document,
      country: input.country,
      city: input.city,
      address: input.address,
      // ⚠️ `acceptsMarketing` NO se toca aquí para un cliente que ya existe.
      // Antes se hacía con `found.acceptsMarketing || input.acceptsMarketing`,
      // y eso RE-SUSCRIBÍA a quien se había dado de baja con solo volver a
      // comprar: la baja dejaba de significar nada, que es exactamente lo que
      // la Ley 1581 prohíbe. La suscripción la decide `subscribeFromCheckout()`
      // después de crear el pedido, que respeta la baja y deja constancia.
    },
  });
}
