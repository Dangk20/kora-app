import type { cookies as es } from "../es/cookies";

export const cookies: typeof es = {
  titulo: "Your privacy",
  texto: (plataformas: string) =>
    `We use our own cookies to make the store work. With your permission, we also use ${plataformas} cookies to measure which ads work and show you more relevant ads.`,
  y: "and",
  politica: "Privacy policy",
  aceptar: "Accept",
  rechazar: "Necessary only",
  preferencias: "Cookie preferences",
};
