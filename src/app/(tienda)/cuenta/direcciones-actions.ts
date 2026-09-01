"use server";

// Acciones de la libreta de direcciones del comprador.
//
// Todas pasan por `requireBuyer()` y le entregan el `customerId` al módulo,
// que lo pone EN EL `where` de cada consulta. Aquí no se comprueba la
// pertenencia después de leer: esa comprobación es la que se olvida.

import { revalidatePath } from "next/cache";
import { requireBuyer } from "@/modules/buyer/guard";
import {
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
  type AddressInput,
} from "@/modules/customers/addresses";

export type DireccionState = { error?: string; ok?: boolean } | null;

function leer(formData: FormData): AddressInput {
  const t = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    label: t("label"),
    country: t("country") === "US" ? "US" : "CO",
    state: t("state"),
    city: t("city"),
    address: t("address"),
    address2: t("address2"),
    neighborhood: t("neighborhood"),
    zip: t("zip"),
    notes: t("notes"),
  };
}

/** Lo mínimo para que una dirección sirva para entregar algo. */
function problema(d: AddressInput): string | null {
  if (!d.address) return "Escribe la dirección de entrega.";
  if (!d.city) return "Escribe la ciudad.";
  if (!d.state) {
    return d.country === "US" ? "Elige el estado." : "Elige el departamento.";
  }
  if (d.country === "CO" && !d.neighborhood) return "Escribe el barrio.";
  if (d.country === "US" && !d.zip) return "Escribe el ZIP.";
  return null;
}

export async function guardarDireccion(
  _prev: DireccionState,
  formData: FormData,
): Promise<DireccionState> {
  const buyer = await requireBuyer();
  const datos = leer(formData);

  const falla = problema(datos);
  if (falla) return { error: falla };

  const id = String(formData.get("id") ?? "").trim();
  const predeterminada = formData.get("isDefault") === "on";

  if (id) {
    const hecho = await updateAddress(buyer.customerId, id, datos, predeterminada);
    // `false` = esa dirección no es suya. Se responde igual que si no existiera:
    // decir "no es tuya" confirmaría que existe.
    if (!hecho) return { error: "No encontramos esa dirección." };
  } else {
    await createAddress(buyer.customerId, datos, predeterminada);
  }

  revalidatePath("/cuenta");
  return { ok: true };
}

export async function eliminarDireccion(formData: FormData): Promise<void> {
  const buyer = await requireBuyer();
  const id = String(formData.get("id") ?? "").trim();
  if (id) await deleteAddress(buyer.customerId, id);
  revalidatePath("/cuenta");
}

export async function marcarPredeterminada(formData: FormData): Promise<void> {
  const buyer = await requireBuyer();
  const id = String(formData.get("id") ?? "").trim();
  if (id) await setDefaultAddress(buyer.customerId, id);
  revalidatePath("/cuenta");
}

/**
 * Guarda en la libreta la dirección con la que se acaba de comprar.
 *
 * Se llama DESPUÉS de crear el pedido y nunca antes: el pedido es la venta y
 * no puede depender de que la libreta escriba bien. Si esto falla, el
 * comprador se queda sin la comodidad, no sin la compra.
 */
export async function guardarDireccionDelPedido(datos: AddressInput): Promise<void> {
  const buyer = await requireBuyer();
  if (!datos.address?.trim() || !datos.city?.trim()) return;
  await createAddress(buyer.customerId, datos);
}
