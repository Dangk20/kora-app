// El origen del visitante de la petición en curso.
//
// Aparte de `index.ts` porque este archivo sí importa `next/headers`, y el
// módulo tiene que poder usarse fuera de una petición (tests, scripts).

import { headers } from "next/headers";
import { origenDesdeCabeceras, type Origen } from "./index";

export async function origenDeLaPeticion(): Promise<Origen> {
  return origenDesdeCabeceras(await headers());
}
