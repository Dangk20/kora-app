## Decisiones

**Sin rutas por idioma (`/en/...`).** Las URL no cambian: el idioma es una preferencia del visitante como la moneda, con la misma precedencia (cookie > origen > español) y la misma fuente de origen (`src/modules/geo/`). Rutas por idioma obligarían a mover toda la app bajo `[locale]` el día de la apertura. Contrapartida asumida: Google indexa la versión en español; el SEO en inglés queda para después.

**Diccionarios tipados, sin librería.** `src/modules/i18n/messages/es.ts` define la forma; `en.ts` la satisface por tipo, así que una clave sin traducir no compila. Servidor: `await getMessages()`. Cliente: `useMessages()` desde un proveedor que el layout de la tienda llena con el diccionario activo. Una librería (next-intl) trae enrutado y formato que aquí no se usan.

**El contenido de catálogo se resuelve en las consultas de la tienda.** `nameEn`/`descriptionEn` se eligen al construir `StoreProduct` según el idioma, con caída al español. El panel y la Vitrina del panel siguen leyendo en español.

**El buscador busca en los dos idiomas**: quien escribe "shorts" debe encontrar "Short de denim".

**Traducción inicial por SKU**: se cargan con un script desde un archivo `SKU → título EN, descripción EN`, idempotente; el panel permite corregir cada una.
