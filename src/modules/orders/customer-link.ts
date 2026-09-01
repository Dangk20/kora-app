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
  /** Resto de la dirección de entrega, para estrenar la libreta del cliente. */
  state?: string | null;
  address2?: string | null;
  neighborhood?: string | null;
  zip?: string | null;
  notes?: string | null;
};

/**
 * Reconoce o crea el cliente del pedido.
 *
 * CON SESIÓN es quien está dentro: la identidad ya está demostrada y buscar por
 * coincidencia sobra. Además estorba — un dedazo en el teléfono crearía un
 * cliente nuevo para alguien que ya está dentro, partiendo en dos su historial
 * y su saldo de cashback.
 *
 * SIN SESIÓN, cliente silencioso (PED_HU001 §4): coincidencia por correo y,
 * solo en segundo lugar, por teléfono.
 *
 * ⚠️ EL ORDEN NO ES UN DETALLE (corregido el 1 sep 2026, lo encontró Daniel
 * probando). Antes era `findFirst` con un `OR` de correo y teléfono, que no
 * tiene precedencia: si alguien reutilizaba un teléfono, ganaba esa
 * coincidencia y el pedido quedaba anclado a un cliente **con otro correo**.
 * Al crear después la cuenta con el correo del pedido no aparecía ningún
 * pedido, porque ese correo ya no era de nadie. Es justo lo contrario de lo
 * que promete el correo de bienvenida.
 *
 * Un teléfono compartido NO es la misma persona: en una familia, en un
 * negocio o en un teléfono reasignado, fusionar por teléfono le enseñaría a
 * alguien el historial y el saldo de cashback de otro. Por eso el teléfono
 * solo sirve cuando no contradice al correo.
 */
export async function resolveOrderCustomer(tx: Tx, input: OrderCustomerInput) {
  const found = input.buyerCustomerId
    ? await tx.customer.findUnique({ where: { id: input.buyerCustomerId } })
    : await buscarPorIdentidad(tx, input.email, input.phone);

  // ⚠️ ¿El teléfono ya es de OTRO cliente? `phone` es ÚNICO en la base, así
  // que escribirlo repetido —al crear o al actualizar— revienta la
  // transacción del pedido: una venta perdida por un choque de datos, y
  // delante del comprador. Ocurre en dos caminos distintos y por eso la
  // comprobación vive aquí, antes de decidir: al crear un cliente nuevo con un
  // teléfono compartido, y al actualizar un cliente reconocido por correo cuyo
  // teléfono nuevo ya pertenece a otro.
  //
  // No se pierde nada: el pedido guarda su propio `contactPhone`, que es lo
  // que el operador usa para llamar. El teléfono del cliente es dato de
  // contacto; la identidad es el correo.
  const telefonoDeOtro = await tx.customer.findFirst({
    where: {
      phone: input.phone,
      ...(found ? { id: { not: found.id } } : {}),
    },
    select: { id: true },
  });

  if (!found) {
    const creado = await tx.customer.create({
      data: {
        name: input.name,
        phone: telefonoDeOtro ? null : input.phone,
        email: input.email,
        document: input.document ?? null,
        country: input.country,
        source: "WEB",
        acceptsMarketing: input.acceptsMarketing,
      },
    });
    await estrenarLibreta(tx, creado.id, input);
    return creado;
  }

  const actualizado = await tx.customer.update({
    where: { id: found.id },
    data: {
      name: input.name,
      ...(telefonoDeOtro ? {} : { phone: input.phone }),
      // El correo de un cliente que YA existe no se reescribe nunca, ni con
      // sesión ni sin ella. Solo se rellena si estaba vacío.
      //
      // Antes se reescribía cuando no había sesión, y eso tenía dos filos:
      // (a) el correo es la CREDENCIAL de acceso, así que un pedido de
      // invitado que coincidiera por teléfono cambiaba —sin avisar— con qué
      // correo entra a su cuenta el dueño de ese teléfono; y (b) `email` es
      // ÚNICO en la base, así que si ese correo ya era de otro cliente la
      // escritura fallaba y se caía la transacción entera del pedido: una
      // venta perdida por un choque de datos. Cambiar el correo se hace desde
      // la cuenta, a propósito.
      ...(found.email ? {} : { email: input.email }),
      document: input.document ?? found.document,
      country: input.country,
      // ⚠️ `acceptsMarketing` NO se toca aquí para un cliente que ya existe.
      // Antes se hacía con `found.acceptsMarketing || input.acceptsMarketing`,
      // y eso RE-SUSCRIBÍA a quien se había dado de baja con solo volver a
      // comprar: la baja dejaba de significar nada, que es exactamente lo que
      // la Ley 1581 prohíbe. La suscripción la decide `subscribeFromCheckout()`
      // después de crear el pedido, que respeta la baja y deja constancia.
    },
  });

  await estrenarLibreta(tx, actualizado.id, input);
  return actualizado;
}

/**
 * Si el cliente no tiene NINGUNA dirección, la del pedido estrena su libreta.
 *
 * Solo si está vacía: quien ya tiene direcciones las administra él, y crear
 * una por cada compra le llenaría la libreta de duplicados. Sirve para el caso
 * que importa —compró como invitado y después crea cuenta— porque se encuentra
 * su dirección ya guardada.
 *
 * Escribir aquí `customer.city`/`address` sería el segundo escritor del espejo;
 * lo hace `sincronizarDireccionPrincipal` al crear la dirección.
 */
async function estrenarLibreta(tx: Tx, customerId: string, input: OrderCustomerInput) {
  if (!input.address?.trim()) return;

  const tiene = await tx.customerAddress.findFirst({
    where: { customerId },
    select: { id: true },
  });
  if (tiene) return;

  await tx.customerAddress.create({
    data: {
      customerId,
      label: "Mi dirección",
      country: input.country === "US" ? "US" : "CO",
      state: input.state?.trim() || null,
      city: input.city?.trim() || null,
      address: input.address.trim(),
      address2: input.address2?.trim() || null,
      neighborhood: input.country === "US" ? null : input.neighborhood?.trim() || null,
      zip: input.country === "US" ? input.zip?.trim() || null : null,
      notes: input.notes?.trim() || null,
      isDefault: true,
    },
  });

  await tx.customer.update({
    where: { id: customerId },
    data: { city: input.city?.trim() || null, address: input.address.trim() },
  });
}

/**
 * El cliente que corresponde a lo que alguien escribió en el formulario.
 *
 * 1. Por CORREO. Es la identidad de la cuenta del comprador: con eso entra,
 *    ahí le llegan sus comprobantes y por ahí recupera su historial.
 * 2. Si no hay, por TELÉFONO — pero solo si ese cliente no tiene ya otro
 *    correo. Si lo tiene, no sabemos que sea la misma persona, y equivocarse
 *    aquí significa enseñarle a alguien las compras y el saldo de otro.
 * 3. Si nada encaja, no hay cliente: el que llama creará uno nuevo. Duplicar
 *    un cliente es un problema del operador; fusionar dos personas distintas
 *    es un problema del comprador, y de los que no se pueden deshacer.
 */
async function buscarPorIdentidad(tx: Tx, email: string, phone: string) {
  const porCorreo = await tx.customer.findFirst({ where: { email } });
  if (porCorreo) return porCorreo;

  const porTelefono = await tx.customer.findFirst({ where: { phone } });
  if (porTelefono && (!porTelefono.email || porTelefono.email === email)) {
    return porTelefono;
  }
  return null;
}
