import type { NextConfig } from "next";

// Dentro de la imagen de Docker no se revisan tipos ni lint. No es un atajo:
// el CI corre `typecheck`, `lint` y `test` como COMPUERTA antes de construir
// la imagen (specs/continuous-deployment — "Ninguna integración sin verificación
// previa"), así que repetirlo aquí duplica trabajo en cada despliegue y exige
// memoria que un ejecutor pequeño no siempre tiene.
//
// Se activa solo con DOCKER_BUILD=1, que únicamente pone el Dockerfile: un
// `pnpm build` en la máquina de cualquiera conserva ambas revisiones.
const enImagenDocker = process.env.DOCKER_BUILD === "1";

const nextConfig: NextConfig = {
  // Empaqueta la app con solo las dependencias que realmente usa, en
  // .next/standalone. Es lo que permite que la imagen de producción no lleve
  // node_modules completo.
  output: "standalone",

  eslint: { ignoreDuringBuilds: enImagenDocker },
  typescript: { ignoreBuildErrors: enImagenDocker },
};

export default nextConfig;
