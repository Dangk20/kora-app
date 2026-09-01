// La libreta de direcciones de un cliente.
//
// Ver openspec/changes/libreta-de-direcciones — specs/buyer-addresses.
//
// DOS REGLAS QUE NO SE NEGOCIAN:
//
// 1. `customerId` va SIEMPRE en el `where`, nunca en una comprobación después
//    de leer. Es la misma regla que el resto de la cuenta del comprador: así
//    una dirección ajena no se lee, ni se edita, ni se borra, y la respuesta
//    no delata si existe.
//
// 2. `customer.city` y `customer.address` los escribe UNA sola función
//    —`sincronizarDireccionPrincipal`— y siempre desde la predeterminada. Son
//    un espejo para que el panel siga funcionando sin cambios; el día que el
//    módulo de clientes lea la libreta, esas dos columnas se van.

import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export type AddressInput = {
  label?: string | null;
  country: string;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  address2?: string | null;
  neighborhood?: string | null;
  zip?: string | null;
  notes?: string | null;
};

export type Address = AddressInput & {
  id: string;
  isDefault: boolean;
};

const limpio = (v: string | null | undefined) => v?.trim() || null;

function normalizar(input: AddressInput) {
  return {
    label: limpio(input.label),
    country: input.country === "US" ? "US" : "CO",
    state: limpio(input.state),
    city: limpio(input.city),
    address: limpio(input.address),
    address2: limpio(input.address2),
    // Barrio solo en Colombia, ZIP solo en EE.UU.: guardar el campo del otro
    // país deja datos que ninguna pantalla vuelve a enseñar y que reaparecen
    // si el comprador cambia el país de la dirección.
    neighborhood: input.country === "US" ? null : limpio(input.neighborhood),
    zip: input.country === "US" ? limpio(input.zip) : null,
    notes: limpio(input.notes),
  };
}

/** La predeterminada primero; después, las más recientes. */
export async function listAddresses(customerId: string): Promise<Address[]> {
  return db.customerAddress.findMany({
    where: { customerId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      label: true,
      country: true,
      state: true,
      city: true,
      address: true,
      address2: true,
      neighborhood: true,
      zip: true,
      notes: true,
      isDefault: true,
    },
  });
}

/**
 * Escribe `customer.city`/`address` desde la dirección predeterminada.
 *
 * La ÚNICA función que toca esas dos columnas. Si hubiera dos, se separarían:
 * es lo que siempre pasa con un dato duplicado que dos sitios mantienen.
 */
async function sincronizarDireccionPrincipal(tx: Tx, customerId: string): Promise<void> {
  const principal = await tx.customerAddress.findFirst({
    where: { customerId, isDefault: true },
    select: { city: true, address: true },
  });
  await tx.customer.update({
    where: { id: customerId },
    data: { city: principal?.city ?? null, address: principal?.address ?? null },
  });
}

/** Deja SOLO `id` como predeterminada. Se llama dentro de una transacción. */
async function marcarUnica(tx: Tx, customerId: string, id: string): Promise<void> {
  await tx.customerAddress.updateMany({
    where: { customerId, id: { not: id } },
    data: { isDefault: false },
  });
  await tx.customerAddress.updateMany({
    where: { customerId, id },
    data: { isDefault: true },
  });
}

export async function createAddress(
  customerId: string,
  input: AddressInput,
  hacerPredeterminada = false,
): Promise<string> {
  return db.$transaction(async (tx) => {
    // La PRIMERA dirección queda predeterminada sola: nadie debería tener que
    // marcar como principal la única que tiene.
    const cuantas = await tx.customerAddress.count({ where: { customerId } });
    const primera = cuantas === 0;

    const creada = await tx.customerAddress.create({
      data: { ...normalizar(input), customerId, isDefault: primera },
      select: { id: true },
    });

    if (!primera && hacerPredeterminada) await marcarUnica(tx, customerId, creada.id);
    await sincronizarDireccionPrincipal(tx, customerId);
    return creada.id;
  });
}

export async function updateAddress(
  customerId: string,
  id: string,
  input: AddressInput,
  hacerPredeterminada = false,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.customerAddress.updateMany({
      where: { customerId, id },
      data: normalizar(input),
    });
    if (count === 0) return false;

    if (hacerPredeterminada) await marcarUnica(tx, customerId, id);
    await sincronizarDireccionPrincipal(tx, customerId);
    return true;
  });
}

export async function setDefaultAddress(customerId: string, id: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const existe = await tx.customerAddress.findFirst({
      where: { customerId, id },
      select: { id: true },
    });
    if (!existe) return false;

    await marcarUnica(tx, customerId, id);
    await sincronizarDireccionPrincipal(tx, customerId);
    return true;
  });
}

/**
 * Borra una dirección. Se permite aunque un pedido pasado la haya usado: el
 * pedido lleva su propio snapshot de entrega y no se toca. Impedirlo obligaría
 * a explicarle al comprador que no puede quitar una dirección donde ya no vive
 * por una razón que es solo nuestra.
 */
export async function deleteAddress(customerId: string, id: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const actual = await tx.customerAddress.findFirst({
      where: { customerId, id },
      select: { id: true, isDefault: true },
    });
    if (!actual) return false;

    await tx.customerAddress.deleteMany({ where: { customerId, id } });

    // Si se fue la que mandaba, otra la sustituye: quedarse sin ninguna
    // marcada dejaría el checkout sin nada que preseleccionar.
    if (actual.isDefault) {
      const siguiente = await tx.customerAddress.findFirst({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (siguiente) await marcarUnica(tx, customerId, siguiente.id);
    }

    await sincronizarDireccionPrincipal(tx, customerId);
    return true;
  });
}

/**
 * Para el panel: cambiar la dirección de un cliente actualiza su
 * predeterminada, en vez de escribir las columnas sueltas por su cuenta.
 * Si el cliente no tenía ninguna, se le crea.
 */
export async function setPrincipalDesdePanel(
  customerId: string,
  datos: { city?: string | null; address?: string | null; country?: string | null },
): Promise<void> {
  const principal = await db.customerAddress.findFirst({
    where: { customerId, isDefault: true },
    select: { id: true, country: true },
  });

  if (!principal) {
    if (!limpio(datos.city) && !limpio(datos.address)) {
      // Nada que guardar: no se crea una dirección vacía.
      await db.customer.update({ where: { id: customerId }, data: { city: null, address: null } });
      return;
    }
    await createAddress(customerId, {
      label: "Mi dirección",
      country: datos.country ?? "CO",
      city: datos.city,
      address: datos.address,
    });
    return;
  }

  await db.$transaction(async (tx) => {
    await tx.customerAddress.updateMany({
      where: { customerId, id: principal.id },
      data: { city: limpio(datos.city), address: limpio(datos.address) },
    });
    await sincronizarDireccionPrincipal(tx, customerId);
  });
}
