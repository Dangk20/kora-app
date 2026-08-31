// Moneda activa del visitante (TIE_HU001).
//
// Precedencia: elección manual (cookie) > origen del visitante > COP.
// La elección manual NUNCA se sobrescribe por la detección.
//
// De dónde entra el visitante lo contesta `src/modules/geo/`, que es la única
// definición de esa pregunta. Aquí solo vive la precedencia y la traducción
// origen → moneda vive en `index.ts`, con el resto de reglas puras.
import { cookies } from "next/headers";
import { origenDeLaPeticion } from "@/modules/geo/request";
import { currencyForOrigin, isCurrency, type Currency } from "./index";

export const CURRENCY_COOKIE = "kora_moneda";
export const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function activeCurrency(): Promise<Currency> {
  const store = await cookies();
  const chosen = store.get(CURRENCY_COOKIE)?.value;
  if (isCurrency(chosen)) return chosen;

  return currencyForOrigin(await origenDeLaPeticion());
}
