# geo — ¿de dónde entra este visitante?

La **única** definición de esa pregunta en el sistema. Nadie más lee cabeceras de geolocalización ni consulta la tabla de IPs: se pregunta aquí.

```ts
import { origenDesdeCabeceras } from "@/modules/geo";       // puro, recibe Headers
import { origenDeLaPeticion } from "@/modules/geo/request";  // envoltorio de next/headers
```

La respuesta es una de **tres**: `colombia`, `exterior` o `desconocido`. `desconocido` significa "no lo sé" y es distinta de `exterior`; nunca se disfraza de país.

Hoy la usa la moneda de la tienda (TIE_HU001 §1): Colombia → COP, exterior → USD, desconocido → COP. Esa traducción vive en `pricing`, no aquí — este módulo no sabe de dinero.

## De dónde sale el dato

1. **Cabecera de país de un CDN** (`cf-ipcountry`, `x-vercel-ip-country`, `x-geo-country`). Va primero porque su dato es mejor que el nuestro. Hoy no llega ninguna: `korashopp.com` resuelve directo al VPS y no hay nada delante. El día que lo haya, toma el mando sin tocar código. Los valores que significan "no sé" (`XX` de Cloudflare, `T1` de Tor, cualquier cosa que no sean dos letras) se descartan y se sigue con la tabla.
2. **Tabla local IP → origen** (`tabla.ts`), sobre la IP de confianza del visitante.
3. **`desconocido`.**

## Lo que hay que saber antes de tocarlo

- **Los huecos de la tabla son datos, no un descuido.** En IPv4 la tabla lista los rangos *asignados* con su marca y deja intacto el espacio sin asignar. Una IP que cae en un hueco es `desconocido`. Eso es lo que hace que un bloque colombiano asignado *después* de la instantánea envejezca hacia COP y no hacia una tienda en dólares donde nada se puede comprar.
- **En IPv6 solo se confirma Colombia.** Solo se vendorizan los rangos colombianos: conservar los huecos costaría ~60.000 rangos por la fragmentación del espacio asignado. Un visitante extranjero que entre por IPv6 verá COP hasta que use el selector — el lado barato del error. Con un CDN delante la limitación desaparece sola.
- **La IP se lee POR LA DERECHA de `X-Forwarded-For`.** La última entrada es la que añadió nuestro borde; las anteriores son texto que eligió el cliente. El `Caddyfile` además sobrescribe la cabecera con la IP del par TCP. Son dos capas porque cada una sola se puede saltar.
- **La tabla se genera, no se edita**: `pnpm geo:update` (descarga la fuente de dominio público y reescribe `tabla.ts`). No corre en el build ni en el arranque, y la aplicación nunca sale a internet para resolver una petición.
- **`pnpm geo:check <ip>`** dice qué se decidiría para una IP. Existe porque el fallo de este mecanismo es silencioso: una detección apagada no da ningún error, solo una tienda que enseña pesos a todo el mundo.

Contexto completo: `openspec/changes/deteccion-moneda-por-ip`.
