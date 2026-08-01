// Tipos y límites del módulo de campañas. SIN DEPENDENCIAS.
//
// Existe aparte porque el formulario del panel es un componente de cliente y
// necesita el tipo del segmento y los topes de los campos. Si los tomara de
// `audience.ts` o `content.ts`, arrastraría Prisma y `node:fs` al paquete del
// navegador — y el build falla, que es la forma amable de enterarse.

export type ActivityFilter =
  | "todos"
  | "activos_30"
  | "activos_60"
  | "activos_90"
  | "inactivos_90"
  | "sin_compras";

export type AccountFilter = "todos" | "con_cuenta" | "invitados";
export type CountryFilter = "CO" | "US" | "ambos";

export type Segment = {
  country: CountryFilter;
  activity: ActivityFilter;
  account: AccountFilter;
  /** Categorías compradas. Vacío = sin filtro por categoría. */
  categoryIds: string[];
};

export const SEGMENTO_VACIO: Segment = {
  country: "ambos",
  activity: "todos",
  account: "todos",
  categoryIds: [],
};

export const ACTIVIDAD_LABEL: Record<ActivityFilter, string> = {
  todos: "todos",
  activos_30: "activos 30 d",
  activos_60: "activos 60 d",
  activos_90: "activos 90 d",
  inactivos_90: "inactivos +90 d",
  sin_compras: "sin compras",
};

// Topes de los campos del contenido. El asunto y el preheader son lo que se ve
// en la bandeja: pasados de largo, el cliente de correo los corta y el mensaje
// pierde justo el final, que es donde suele estar el gancho.
export const MAX_PRODUCTOS = 6;
export const MAX_ASUNTO = 80;
export const MAX_PREHEADER = 100;
