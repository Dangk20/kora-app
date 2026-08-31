## Context

Ver `proposal.md` — Why. Lo que condiciona el diseño, y no está allí:

- **No hay nada delante del VPS.** `korashopp.com` resuelve directo a Caddy. Ninguna cabecera de geolocalización existe, ni la va a poner nadie mientras el DNS no se mueva.
- **La red de la aplicación es cerrada.** El contenedor de la app habla con Caddy y con Postgres; darle salida a internet para consultar un servicio de geolocalización en cada petición abriría una ruta que el aislamiento actual evita a propósito (mismo criterio que en los respaldos).
- **La IP de un visitante es dato personal.** Mandarla a un tercero en cada visita habría que declararlo en la política de tratamiento de datos que este proyecto ya publica. No se hace.
- **El rastreo de archivos de Next es estático.** Un archivo de datos leído con `fs` en tiempo de ejecución puede no viajar en la salida standalone: la lección de `sharp` costó tres despliegues. Todo dato que la aplicación necesite entra por un `import`, no por una ruta de disco.

## Goals / Non-Goals

**Goals:**
- Una sola definición de "de dónde entra este visitante", en `src/modules/geo/`, que nadie más duplique.
- Resolución local, determinista y sin red: la misma IP da siempre la misma respuesta, y funciona con el servidor incomunicado.
- Ruta de mejora sin tocar código: si aparece un CDN que emita país, manda él.
- La duda cae siempre del lado COP.

**Non-Goals:**
- Precisión a nivel de ciudad, región o ASN. La pregunta es binaria más un "no sé".
- Actualización automática de la tabla. Se regenera a mano y se revisa como cualquier otro cambio.
- Cobertura IPv6 completa. Se documenta el techo en vez de fingir que no existe.

## Decisions

### 1. Tabla local vendorizada, no servicio externo ni base de datos con licencia

**Elegido:** una tabla generada desde `ip-location-db` (variante `geo-whois-asn-country`, dominio público / CC0), reducida a lo que este producto necesita y guardada en el repositorio como módulo TypeScript.

- *Servicio externo por petición (ipapi, ipinfo, ip-api)* — descartado: latencia en la primera visita, cuota gratuita que se agota sin avisar, cuenta y token que mantener, y la IP de cada visitante viajando a un tercero.
- *MaxMind GeoLite2* — descartado: exige cuenta y clave de licencia, su redistribución está restringida (no se puede versionar el `.mmdb`), y descargarla en el build metería credenciales y red en el CI para un dato que cambia una vez al mes.
- *Módulo GeoIP de Caddy* — descartado: obliga a compilar una imagen propia de Caddy. El borde es la pieza que debe seguir en pie cuando todo lo demás falla; no es donde se añade superficie.
- *Cloudflare delante* — no es alternativa sino complemento: cuando llegue, sus cabeceras tienen prioridad sobre esta tabla (decisión 4).

### 2. Tres respuestas, y la tabla guarda los huecos

La tabla IPv4 no es una lista de rangos colombianos: es la lista de rangos **asignados**, cada uno marcado como colombiano o no, con los huecos —espacio sin asignar— intactos. Una IP que cae en un hueco es `desconocido`, no `exterior`.

La diferencia parece cosmética y es la decisión central del cambio. Cuando LACNIC asigna un bloque nuevo a un ISP colombiano, ese bloque estaba **en un hueco** de nuestra instantánea. Con huecos → `desconocido`, ese colombiano ve COP: la respuesta correcta por el camino equivocado. Con una simple lista positiva de Colombia, vería USD, y si el catálogo aún no tiene precios en dólares, vería una tienda donde nada se puede comprar. El error tiene que envejecer hacia el lado seguro.

Coste: 11.807 rangos en vez de 2.258. ~140 KB.

### 3. IPv6: solo se confirma Colombia, y se dice

Mantener los huecos en IPv6 cuesta 59.702 rangos (~900 KB) porque el espacio asignado está fragmentado. No lo vale para un catálogo de dos monedas. Se vendorizan **solo los 1.031 rangos colombianos**: una IPv6 dentro de ellos es `colombia`; cualquier otra es `desconocido` → COP.

Consecuencia honesta: un visitante extranjero que entre por IPv6 ve pesos hasta que toque el selector. Es el error barato y reversible, no el caro. Y desaparece solo el día que haya un CDN emitiendo `cf-ipcountry`, que es un argumento de producto a favor de mover el DNS.

### 4. Orden de fuentes fijo, y "no sé" no corta la cadena

`cabecera de CDN → tabla local → desconocido`. Una cabecera presente pero inútil (`XX` de Cloudflare, `T1` de Tor, vacío, algo que no son dos letras) **no** se toma como respuesta: cede el turno a la tabla. Tratar `XX` como país produciría `exterior` para todo visitante que Cloudflare no sabe ubicar — exactamente el error caro, y llegando desde la fuente que se suponía más fiable.

### 5. La IP se toma por la derecha, y el borde la sobrescribe

Dos capas, porque cada una sola se puede saltar:

- En `deploy/Caddyfile`, cada `reverse_proxy` lleva `header_up X-Forwarded-For {remote_host}`: la cabecera que llega a la aplicación es la IP del par TCP, y lo que el cliente hubiera escrito se descarta en el borde.
- En el código, se lee la entrada **más a la derecha** de `X-Forwarded-For`. Es la que añade el último proxy; la primera es texto que eligió el cliente. Si mañana alguien quita el `header_up`, o se intercala otro proxy, el código sigue sin dejarse dictar el país.

Sin esto, cambiar de moneda es tan fácil como mandar una cabecera. Hoy eso solo alteraría la presentación —el precio del pedido se resuelve en servidor (`resolvePrice()`)—, pero deja de ser inocuo en cuanto la moneda condicione un cupón o una regla comercial.

### 6. Formato: un módulo TypeScript generado, no un archivo de datos leído del disco

`src/modules/geo/tabla.ts` exporta cadenas codificadas y la fecha de la instantánea. Entra por `import`, así que el rastreo estático de Next lo lleva a la salida standalone sin trucos: la lección de `sharp` aplicada antes de que cueste un despliegue.

Codificación, elegida para que el archivo sea pequeño y `tsc` no tenga que tipar 12.000 literales:

- **IPv4** — una sola cadena. Cada rango es `hueco:tamaño` en base 36 más una letra (`c` Colombia, `x` exterior), separados por comas; `hueco` es la distancia desde el final del rango anterior, `tamaño` es la longitud menos uno. Se parsea una vez, de forma perezosa, a dos `Uint32Array` y un `Uint8Array`, y se busca por bisección.
- **IPv6** — los 1.031 rangos colombianos como pares de enteros de 128 bits en base 36. Se parsean a `BigInt` y se buscan por bisección. Sin truncar a `/48` ni a `/64`: la aritmética exacta cuesta microsegundos a esta escala y evita una sutileza que nadie recordaría dentro de seis meses.

La generación vive en `scripts/update-geo.ts` (`pnpm geo:update`). Descarga, colapsa, escribe. Nunca corre en el build ni en el arranque.

### 7. Dónde vive la lógica

`src/modules/geo/` — dominio propio, no un rincón de `pricing`. La pregunta "¿de dónde entra este visitante?" no es sobre precios: hoy la usa la moneda, mañana podría usarla un aviso de envío. `src/modules/pricing/currency.ts` pierde su lista de cabeceras y pasa a preguntar, con lo que la precedencia cookie > geo > COP queda en un solo sitio y la geolocalización en otro.

Archivos: `index.ts` (origen del visitante y precedencia de fuentes), `ip.ts` (IP de confianza y direcciones sin origen geográfico), `lookup.ts` (bisección sobre la tabla), `tabla.ts` (**generado**), `README.md`.

### 8. Sin migración, sin eventos

No hay cambio de esquema Prisma. No se emite ni se consume nada de `domain_events`. No hay pantalla nueva, así que no hay sección del prototipo que replicar: el selector de moneda del header ya existe y no se toca.

## Risks / Trade-offs

- **La tabla envejece: un bloque colombiano nuevo no está en ella** → cae en un hueco y da `desconocido` → COP, que es la respuesta correcta. El envejecimiento degrada hacia lo seguro (decisión 2). `pnpm geo:update` cuando se quiera refrescar.
- **La tabla envejece al revés: un bloque que dejó de ser colombiano** → un extranjero ve COP. Error barato, un clic de distancia.
- **VPN y proxies corporativos dan el país del servidor de salida, no el del visitante** → irreducible con cualquier método basado en IP, incluido Cloudflare. Lo cubre el selector manual, que es persistente y prevalece para siempre.
- **Encender la detección hace visible un problema de datos ajeno al código**: si el catálogo no trae precios en USD, todo visitante correctamente detectado como extranjero verá una tienda no comprable. El comportamiento es el que pide TIE_HU002; la condición de encendido es del negocio. Queda en `../notas-tecnicas-privado.md`, no en la spec.
- **~180 KB de datos generados en el repositorio** → se acepta: es un archivo, con fecha dentro, regenerable con un comando y revisable en un diff.
- **La detección apagada no produce ningún error** — el modo de fallo de todo este cambio. Mitigación: `pnpm geo:check <ip>` responde origen, moneda y fecha de la instantánea sin levantar la tienda.

## Migration Plan

No hay migración de datos ni de esquema. El despliegue es el normal: integrar a `main` despliega a pruebas solo.

1. `pnpm geo:update` genera `tabla.ts`; entra en el mismo commit que el código.
2. Se despliega a pruebas y se comprueba con `pnpm geo:check` sobre una IP colombiana y una estadounidense conocidas, y visitando la tienda.
3. **`header_up X-Forwarded-For` en el `Caddyfile` no viaja con la imagen**: el borde es un contenedor aparte, con su archivo montado desde el servidor. Hay que aplicarlo a mano (`docker compose -f docker-compose.edge.yml up -d` tras editar). Mientras no se aplique, la detección funciona con la IP que Caddy ya añade a `X-Forwarded-For` —correcta— pero un cliente podría anteponer la suya; leer por la derecha lo cubre igual.
4. **Vuelta atrás**: revertir el commit. No queda estado: ni base, ni caché, ni cookie escrita por la detección. La cookie de moneda solo la escribe una elección manual, y esa se respeta antes y después.
