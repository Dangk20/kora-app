// Etiqueta de cada persona del módulo de clientes: Cliente / No cliente.
// Ver openspec/changes/clientes-registrados — specs/customer-directory.
//
// La etiqueta NO se guarda: se deriva de los pedidos en cada consulta, con la
// misma definición de "pedido confirmado" que usan Ventas, el perfil y las
// campañas. Guardarla sería una segunda fuente de verdad que tendrían que
// mantener la confirmación, la cancelación, el POS y cualquier ajuste manual;
// el primero que se olvide la deja equivocada sin dar error. Derivada, la
// persona pasa a Cliente en el mismo instante en que se confirma su primer
// pedido, porque no hay nada que actualizar.

import type { Prisma } from "@/generated/prisma/client";
import { confirmedFilter } from "./confirmed";

export type Etiqueta = "cliente" | "no_cliente";

export const ETIQUETA_LABEL: Record<Etiqueta, string> = {
  cliente: "Cliente",
  no_cliente: "No cliente",
};

/** Cliente = al menos un pedido confirmado (o posterior), de cualquier canal. */
export function etiquetaDe(pedidosConfirmados: number): Etiqueta {
  return pedidosConfirmados > 0 ? "cliente" : "no_cliente";
}

export const esClienteWhere = {
  orders: { some: confirmedFilter },
} satisfies Prisma.CustomerWhereInput;

/** Igual al segmento "sin_compras" de campañas: ningún pedido confirmado. */
export const noClienteWhere = {
  orders: { none: confirmedFilter },
} satisfies Prisma.CustomerWhereInput;

export type FiltroEtiqueta = "todos" | "clientes" | "no_clientes";

export const FILTROS_ETIQUETA: { key: FiltroEtiqueta; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "clientes", label: "Clientes" },
  { key: "no_clientes", label: "No clientes" },
];

/** Lee el filtro desde la dirección; un valor desconocido es "todos", sin error. */
export function parseFiltroEtiqueta(valor: string | undefined | null): FiltroEtiqueta {
  return FILTROS_ETIQUETA.some((f) => f.key === valor) ? (valor as FiltroEtiqueta) : "todos";
}

export function whereEtiqueta(filtro: FiltroEtiqueta): Prisma.CustomerWhereInput {
  if (filtro === "clientes") return esClienteWhere;
  if (filtro === "no_clientes") return noClienteWhere;
  return {};
}
