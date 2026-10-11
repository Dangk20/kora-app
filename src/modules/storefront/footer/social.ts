// Redes sociales del footer. Opcionales y leídas del entorno en ejecución:
// una red sin dirección NO se pinta. Un ícono que no lleva a ninguna parte
// —o a la página de otra marca con el mismo nombre— es peor que no tenerlo.

export const REDES = [
  { variable: "KORA_SOCIAL_INSTAGRAM", nombre: "Instagram" },
  { variable: "KORA_SOCIAL_TIKTOK", nombre: "TikTok" },
  { variable: "KORA_SOCIAL_FACEBOOK", nombre: "Facebook" },
] as const;

export type RedSocial = { nombre: string; url: string };

/** Solo las redes con una dirección https configurada. */
export function redesSociales(env: NodeJS.ProcessEnv = process.env): RedSocial[] {
  return REDES.flatMap(({ variable, nombre }) => {
    const url = env[variable]?.trim();
    return url && /^https:\/\//.test(url) ? [{ nombre, url }] : [];
  });
}
