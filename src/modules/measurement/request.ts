// Lo que el checkout guarda sobre el origen del pedido, leído de la petición en
// curso. Aparte de `attribution.ts` porque este sí importa `next/headers`.

import { cookies, headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { ipDeConfianza } from "@/modules/geo/ip";
import {
  COOKIE_CONSENTIMIENTO,
  COOKIE_ORIGEN,
  fbcFromFbclid,
  gaClientIdFromCookie,
  gaSessionCookieName,
  gaSessionIdFromCookie,
  parseTouch,
} from "./attribution";
import { readMeasurementConfig } from "./config";

/** ¿Aceptó el visitante las cookies de medición? Solo un "si" explícito cuenta. */
export function consintio(valor: string | null | undefined): boolean {
  return valor === "si";
}

/**
 * Los datos de `order_attributions` para un pedido nuevo, sin `orderId`.
 *
 * Devuelve `null` si no hay nada que guardar (sin origen y sin consentimiento):
 * una fila vacía por pedido no dice nada y ocupa.
 */
export async function attributionForOrder(): Promise<Omit<
  Prisma.OrderAttributionUncheckedCreateInput,
  "orderId"
> | null> {
  const jar = await cookies();
  const consent = consintio(jar.get(COOKIE_CONSENTIMIENTO)?.value);
  const touch = parseTouch(jar.get(COOKIE_ORIGEN)?.value);

  if (!consent && !touch) return null;

  const base = {
    consent,
    source: touch?.source ?? null,
    medium: touch?.medium ?? null,
    campaign: touch?.campaign ?? null,
    content: touch?.content ?? null,
    term: touch?.term ?? null,
    fbclid: touch?.fbclid ?? null,
    gclid: touch?.gclid ?? null,
    landing: touch?.landing ?? null,
    touchAt: touch ? new Date(touch.at) : null,
  };
  if (!consent) return base;

  const h = await headers();
  const config = readMeasurementConfig();
  const fbc =
    jar.get("_fbc")?.value ?? (touch?.fbclid ? fbcFromFbclid(touch.fbclid, touch.at) : null);
  const sesion = config.ga4
    ? gaSessionIdFromCookie(jar.get(gaSessionCookieName(config.ga4.measurementId))?.value)
    : null;

  return {
    ...base,
    fbp: jar.get("_fbp")?.value?.slice(0, 200) ?? null,
    fbc: fbc?.slice(0, 300) ?? null,
    gaClientId: gaClientIdFromCookie(jar.get("_ga")?.value),
    gaSessionId: sesion,
    userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
    ipAddress: ipDeConfianza(h),
  };
}
