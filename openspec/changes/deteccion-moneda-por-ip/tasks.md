## 1. Generación de la tabla

- [x] 1.1 Escribir `scripts/update-geo.ts`: descarga los dos CSV de dominio público de `ip-location-db`, ordena, colapsa rangos contiguos de la misma marca y emite `src/modules/geo/tabla.ts` con la fecha de la instantánea, los conteos y el origen citado en la cabecera del archivo.
- [x] 1.2 IPv4: emitir los rangos **asignados** con su marca `c`/`x` y **los huecos intactos**, codificados como `hueco:tamaño` en base 36 separados por comas (design §2 y §6).
- [x] 1.3 IPv6: emitir **solo** los rangos colombianos, como pares de enteros de 128 bits en base 36.
- [x] 1.4 Registrar `pnpm geo:update` en `package.json` y ejecutarlo una vez para dejar `tabla.ts` generada en el repositorio.

## 2. Módulo `src/modules/geo/`

- [x] 2.1 `ip.ts`: IP de confianza desde `X-Forwarded-For` leyendo **la entrada más a la derecha**, con `x-real-ip` como respaldo; devuelve `null` si no hay ninguna o si no es una IP válida.
- [x] 2.2 `ip.ts`: clasificar como sin origen geográfico el bucle local, `10/8`, `172.16/12`, `192.168/16`, `100.64/10`, `169.254/16`, `::1` y `fc00::/7`; y convertir IPv4 e IPv6 a entero para la búsqueda.
- [x] 2.3 `lookup.ts`: parseo perezoso de `tabla.ts` a `Uint32Array`/`BigInt` una sola vez por proceso, y bisección que devuelve `colombia` | `exterior` | `desconocido`.
- [x] 2.4 `index.ts`: `origenDelVisitante()` con la precedencia cabecera de CDN → tabla → `desconocido`, descartando `XX`, `T1`, vacío y cualquier valor que no sean dos letras (design §4).
- [x] 2.5 `README.md` del módulo: qué pregunta contesta, de dónde sale el dato, el techo declarado de IPv6 y cómo se regenera la tabla.

## 3. Conexión con la moneda

- [x] 3.1 `src/modules/pricing/currency.ts`: quitar la lista de cabeceras y delegar en `origenDelVisitante()`, conservando intacta la precedencia cookie > geolocalización > COP.
- [x] 3.2 Comprobar que ninguna otra parte del código lee cabeceras de país por su cuenta (una sola definición).

## 4. Borde y diagnóstico

- [x] 4.1 `deploy/Caddyfile`: `header_up X-Forwarded-For {remote_host}` en el `reverse_proxy` de pruebas y en el de producción (comentado, junto a la línea del go-live), con el motivo escrito al lado.
- [x] 4.2 `scripts/check-geo.ts` + `pnpm geo:check <ip>`: imprime origen, moneda resultante y fecha de la instantánea de la tabla.
- [x] 4.3 Documentar `geo:update` y `geo:check` en el bloque de comandos de `CLAUDE.md`, y corregir allí la frase que da por hecho que se espera `cf-ipcountry`.

## 5. Tests (`tests/geo.test.ts`)

- [x] 5.1 Una IPv4 colombiana conocida → `colombia` → COP; una IPv4 estadounidense conocida → `exterior` → USD.
- [x] 5.2 Una IPv4 en un hueco sin asignar → `desconocido` → COP, **no** `exterior` (la invariante de la decisión §2).
- [x] 5.3 Una IPv6 colombiana → `colombia`; una IPv6 extranjera → `desconocido` → COP (el techo declarado, fijado por test para que no se degrade sin querer).
- [x] 5.4 `X-Forwarded-For` con una IP inventada por el cliente antepuesta a la real → gana la de la derecha.
- [x] 5.5 Bucle local, redes privadas y CGNAT → `desconocido`; cadena corrupta → `desconocido` sin excepción.
- [x] 5.6 Cabecera `cf-ipcountry: XX` y `T1` → se descartan y la resolución continúa por la tabla; `cf-ipcountry: US` → `exterior` sin consultar la tabla.
- [x] 5.7 Cookie de moneda válida → esa moneda, sin consultar ninguna fuente de geolocalización.

## 6. Cierre

- [x] 6.1 Anotar en `../notas-tecnicas-privado.md` el riesgo de negocio que este cambio expone: con la detección encendida, un catálogo sin precios en USD deja la tienda no comprable para todo visitante del exterior.
- [x] 6.2 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde.
