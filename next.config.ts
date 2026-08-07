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

  experimental: {
    // Las imágenes se suben por Server Action, y Next las corta en 1 MB por
    // omisión. La aplicación acepta hasta 5 MB (`MAX_IMAGE_BYTES`), así que
    // toda foto de más de 1 MB moría ANTES de llegar a nuestro código: el
    // operador veía "Application error: a server-side exception has occurred"
    // sin más pista, y en el registro un 413.
    //
    // No es un caso raro: una foto de producto de móvil pesa entre 2 y 4 MB.
    // Nunca se notó porque el catálogo de demostración no tiene ninguna y las
    // pruebas suben archivos de unos pocos KB.
    //
    // 6 MB = los 5 del archivo más el sobre del formulario (nombre, campos,
    // codificación). `tests/limites-subida.test.ts` comprueba que este número
    // siga por encima del que valida la aplicación.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
