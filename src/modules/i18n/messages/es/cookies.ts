// Aviso de cookies de medición (change `medicion-publicitaria`). Solo aparece
// si la tienda tiene Meta o Google configurados.
export const cookies = {
  titulo: "Tu privacidad",
  /** `plataformas`: las que están encendidas, ya unidas ("Meta y Google", "Google"). */
  texto: (plataformas: string) =>
    `Usamos cookies propias para que la tienda funcione. Con tu autorización, también usamos cookies de ${plataformas} para medir qué publicidad funciona y mostrarte anuncios más relevantes.`,
  y: "y",
  politica: "Política de privacidad",
  aceptar: "Aceptar",
  rechazar: "Solo necesarias",
  preferencias: "Preferencias de cookies",
};
