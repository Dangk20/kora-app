## Why

**Pertenece a TIE_HU001 §1** ("Detección automática (primera visita)", `../hus-tienda.md`), la mitad de la historia que quedó sin construir cuando se cerró la tienda pública en S5. No hay HU nueva: esto **termina** una existente.

La precedencia ya está bien resuelta —elección manual (cookie) > geolocalización > COP— y el selector manual del header funciona. Lo que no existe es **la fuente del país**: `activeCurrency()` busca las cabeceras `cf-ipcountry`, `x-vercel-ip-country` y `x-geo-country`, y **ninguna llega**. `korashopp.com` resuelve directo al VPS (Caddy, sin CDN delante), así que hoy **el 100 % de los visitantes cae al default COP** y la detección automática es, en la práctica, una función que siempre devuelve lo mismo. Nada falla, nada se registra: la funcionalidad está apagada en silencio.

Importa ahora porque el go-live está cerca y el segundo mercado del cliente es EE.UU.: un visitante de allá aterriza hoy en una tienda con precios en pesos colombianos y tiene que descubrir el selector por su cuenta.

## What Changes

- **Nuevo módulo `src/modules/geo/`** con **una sola definición** de "de dónde entra este visitante": Colombia, exterior, o desconocido. `activeCurrency()` deja de leer cabeceras a mano y le pregunta a él.
- **Tabla IP → país vendorizada en el repositorio**, generada desde una fuente de dominio público (`ip-location-db`, CC0) por un script versionado. Sin llamada a ningún servicio externo por petición: ni latencia, ni cuota, ni la IP de cada visitante viajando a un tercero — cosa que además habría que declarar en la política de datos.
- **Las cabeceras de CDN siguen teniendo prioridad** sobre la tabla local. Si algún día el DNS pasa por Cloudflare, `cf-ipcountry` toma el mando solo, sin tocar código, y con mejor dato.
- **Tres respuestas, no dos**: `colombia`, `exterior` y `desconocido`. Desconocido → COP. La distinción no es cosmética: es la que impide que un bloque de IP colombiano recién asignado —que la tabla todavía no conoce— empuje a un colombiano a ver dólares.
- **La IP del visitante se toma de forma no falsificable**: Caddy sobrescribe `X-Forwarded-For` con la IP real del par TCP, y el módulo lee la entrada de la derecha. Sin esto, cualquiera fija su país con una cabecera.
- **`pnpm geo:check <ip>`** — dice qué decide el módulo para una IP dada, y `pnpm geo:update` regenera la tabla. Que "no está detectando" se pueda comprobar en un comando, en vez de deducirlo de que todo el mundo ve pesos.

### Limitación declarada (no es un descuido)

Sobre **IPv4** la tabla distingue las tres respuestas. Sobre **IPv6** solo se vendorizan los rangos colombianos: confirmar Colombia sí, confirmar "exterior" no. Un visitante extranjero que entre por IPv6 verá COP hasta que use el selector. Es la dirección segura del error —ver Impacto— y cuesta 30 KB en vez de 900 KB de tabla. Con Cloudflare delante, la limitación desaparece sola.

## Capabilities

### New Capabilities
- `visitor-geolocation`: de qué origen entra un visitante (Colombia / exterior / desconocido), de dónde sale ese dato, en qué orden mandan las fuentes, y qué se hace cuando no se sabe.

### Modified Capabilities
Ninguna. `pricing` no cambia de requisitos: `resolvePrice()` sigue siendo la única fuente de precio y sigue recibiendo la moneda ya resuelta. Lo que cambia es **quién** contesta la pregunta "¿qué moneda?", no la regla.

## Impact

- **Código**: nuevo `src/modules/geo/` (tabla generada, búsqueda, IP del cliente, README). `src/modules/pricing/currency.ts` delega en él y pierde su lista de cabeceras. `scripts/update-geo.ts` y `scripts/check-geo.ts`. `deploy/Caddyfile`: `header_up X-Forwarded-For {remote_host}` en los dos `reverse_proxy`.
- **Datos**: ~180 KB de tabla generada en el repositorio, con su fecha de instantánea escrita dentro. Sin migración, sin esquema, sin estado en base.
- **Dependencias**: ninguna nueva en `package.json`. La descarga ocurre solo al regenerar, a mano, nunca en el build ni en el arranque.
- **Riesgo que este cambio expone, y que es del negocio, no del código**: hasta hoy todo el mundo veía COP. Con la detección encendida, **un visitante del exterior verá USD — y si el catálogo no tiene precios en USD cargados, verá una tienda donde nada se puede comprar** ("No disponible en USD", TIE_HU002). El comportamiento es el que pidió la HU; la condición para encenderlo es que el catálogo real traiga sus dos precios. Queda anotado en `../notas-tecnicas-privado.md`.
- **Asimetría del error, que es la que gobierna todo el diseño**: mostrar COP a un extranjero es incómodo y se arregla con un clic; mostrar USD a un colombiano puede dejarle la tienda vacía. Por eso toda duda cae del lado COP.

## Fuera de alcance

- Mover el DNS a Cloudflare. Es una decisión de infraestructura de Daniel, ya pendiente por otros motivos (CDN para las fotos del catálogo); este cambio funciona sin ella y mejora solo si ocurre.
- Más divisas, conversión por tasa de cambio, e idioma o contenido por país. Explícitamente fuera de TIE_HU001.
- Impuestos, envío o formularios distintos por país. La moneda no arrastra fiscalidad.
- Actualización automática o programada de la tabla. Se regenera a mano, con un comando y un diff que alguien mira.
