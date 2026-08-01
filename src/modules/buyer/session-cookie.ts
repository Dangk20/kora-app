// Transporte de la sesión del comprador: la cookie.
// Separado del mecanismo (`session.ts`) porque este archivo importa
// `next/headers` y el worker de trabajos programados corre FUERA de Next: si
// el barrido de sesiones arrastrara este import, el worker no arrancaría.

import { cookies } from "next/headers";
import {
  issueSession,
  resolveSession,
  revokeSession,
  type BuyerSessionUser,
} from "./session";

export const BUYER_COOKIE = "kora_buyer";

export async function startBuyerSession(customerId: string, userAgent?: string): Promise<void> {
  const { token, expiresAt } = await issueSession(customerId, userAgent);
  const store = await cookies();
  store.set(BUYER_COOKIE, token, {
    httpOnly: true,
    // "lax" y no "strict": la vuelta desde WhatsApp es una navegación entre
    // sitios, y con "strict" el comprador volvería sin sesión.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function currentBuyerToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(BUYER_COOKIE)?.value;
}

export async function currentBuyer(): Promise<BuyerSessionUser | null> {
  return resolveSession(await currentBuyerToken());
}

export async function endBuyerSession(): Promise<void> {
  const token = await currentBuyerToken();
  if (token) await revokeSession(token);
  const store = await cookies();
  store.delete(BUYER_COOKIE);
}
