// Cómo se clasifica a cada persona del Módulo de clientes: CON cuenta o SIN
// cuenta (Daniel, 17 oct 2026). Reemplaza a la etiqueta Cliente / No cliente
// del 11 oct: con la caja guardando clientes que nunca se registran, lo que
// el operador necesita distinguir es quién puede entrar a la tienda. Si
// alguien ya compró se ve en su ficha (pedidos, top de categorías, días).
//
// Como la etiqueta anterior, NO se guarda: se deriva de la contraseña en cada
// consulta. Una columna "rol" sería una segunda verdad que el registro, la
// caja y la importación tendrían que mantener — y "rol" ya nombra los roles
// de acceso al panel (administrador, cajero).
import type { Prisma } from "@/generated/prisma/client";

/** Con cuenta = tiene contraseña en la tienda (cuenta-comprador). */
export const conCuentaWhere = { passwordHash: { not: null } } satisfies Prisma.CustomerWhereInput;
/** Sin cuenta = compró como invitado en la web, en caja, o se creó a mano o importado. */
export const sinCuentaWhere = { passwordHash: null } satisfies Prisma.CustomerWhereInput;

export type FiltroCuenta = "todos" | "con_cuenta" | "sin_cuenta";

export const FILTROS_CUENTA: { key: FiltroCuenta; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "con_cuenta", label: "Con cuenta" },
  { key: "sin_cuenta", label: "Sin cuenta" },
];

/** Lee el filtro desde la dirección; un valor desconocido es "todos", sin error. */
export function parseFiltroCuenta(valor: string | undefined | null): FiltroCuenta {
  return FILTROS_CUENTA.some((f) => f.key === valor) ? (valor as FiltroCuenta) : "todos";
}

export function whereCuenta(filtro: FiltroCuenta): Prisma.CustomerWhereInput {
  if (filtro === "con_cuenta") return conCuentaWhere;
  if (filtro === "sin_cuenta") return sinCuentaWhere;
  return {};
}

/** De dónde llegó la ficha, en palabras del operador. */
export const ORIGEN_LABEL: Record<"WEB" | "POS" | "IMPORT" | "MANUAL", string> = {
  WEB: "Tienda web",
  POS: "Caja",
  IMPORT: "Importado",
  MANUAL: "Creado a mano",
};
