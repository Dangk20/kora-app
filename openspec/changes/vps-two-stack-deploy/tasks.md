# Tareas — despliegue de dos entornos en el VPS propio

> Cada bloque está pensado para cerrarse en 2 horas o menos y verificarse por sí solo.
> Evidencia obligatoria por tarea: salida de comando, verificación contra el servidor real o prueba en verde. Ninguna tarea se marca hecha "porque debería funcionar".

## 1. Empaquetado de la aplicación

- [x] 1.1 Activar `output: "standalone"` en `next.config.ts` y verificar que `pnpm build` genera el directorio autónomo esperado.
      Evidencia: `pnpm build` en verde, `.next/standalone/server.js` generado.
      ⚠️ Hallazgo: el build copia el `.env` de la raíz (con `AUTH_SECRET`) y `.uploads/` dentro de `.next/standalone/`. Debe neutralizarse desde `.dockerignore` (tarea 1.2) y verificarse en 1.4.
- [x] 1.2 Escribir `Dockerfile` multi-etapa (dependencias → compilación → ejecución) sobre imagen base Node LTS delgada, ejecutando como usuario sin privilegios, y `.dockerignore` que excluya `node_modules`, `.next`, `.env*`, `.uploads` y `openspec`.
      Evidencia: `docker build --target runner` termina en verde; imagen de 496 MB; objetivos `runner` y `migrator`.
      Decisiones tomadas al construir: base **Debian slim** en vez de Alpine porque `sharp` (declarado en `allowBuilds`) publica binarios precompilados para glibc; y **sin `--mount=type=cache`** porque exige BuildKit con `buildx`, que no está instalado en la máquina de desarrollo.
- [x] 1.3 Construir la imagen en local y arrancarla contra los contenedores de desarrollo (`pnpm db:up`); verificar que responde y que el cliente de Prisma quedó generado dentro de la imagen.
      Evidencia: `/`, `/catalogo`, `/login` y `/carrito` responden HTTP 200; el producto `[DEMO] Audífonos inalámbricos Ultra` leído de PostgreSQL aparece renderizado en `/catalogo`; el proceso corre como usuario `node`.
- [x] 1.4 Verificar que la imagen **no contiene secretos**: inspeccionar sus capas y variables de entorno en busca de valores de `.env`.
      Evidencia: no existe `/app/.env` ni `/app/.uploads` en la imagen; las variables de entorno de la imagen no contienen secretos; se exportó el sistema de archivos completo y se buscaron los **valores reales** de `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET` y `SHADOW_DATABASE_URL` en 2.356 archivos de `/app`: ninguno presente.
      Nota: buscar por *nombre* de variable da falsos positivos (el código compilado referencia `process.env.AUTH_SECRET`); la verificación válida es por valor.

> **Hallazgo abierto (afecta a la tarea 6.3).** Con `NODE_ENV=production` y sin variables de R2, la aplicación **no falla al arrancar** como afirman el `CLAUDE.md` del repositorio y el plan: arranca, `/login` responde 200, y solo devuelve 500 al renderizar una página que resuelve URLs de imágenes. La guarda es perezosa (al primer uso), no al arranque. Consecuencia para el go-live: el contenedor se reportaría sano con la tienda rota. Pendiente de decisión del responsable — ver informe.

## 1-bis. Guarda de arranque del almacenamiento *(ampliación del 31 jul)*

> Único cambio de lógica en `src/` del change. Nace del hallazgo de la tarea 1.3: la comprobación es perezosa, así que un contenedor mal configurado se reporta sano con la tienda rota.

- [x] 1b.1 Mover la comprobación de configuración del almacenamiento de imágenes de perezosa a **verificación al arranque** en `src/modules/storage/`: en producción, si falta configuración el proceso termina de inmediato con un error que **nombra las variables faltantes**; en desarrollo el driver de disco sigue arrancando sin ella.
      Implementación: `src/modules/storage/config.ts` (única fuente de verdad sobre qué variables se exigen, `StorageConfigError` con la lista de faltantes) + `src/instrumentation.ts`, el gancho oficial de Next que corre una vez al levantar el servidor. `storage()` quedó reescrita para usar la misma fuente en vez de repetir la lista, y conserva la comprobación como segunda línea de defensa para contextos que no pasan por el arranque (scripts, tareas programadas).
      Dos guardas necesarias en `instrumentation.ts`: se omite en el runtime *edge* (donde no aplica ni existe `process.exit`) y durante `phase-production-build` (compilar no es servir; abortar ahí haría imposible construir la imagen sin meterle credenciales de producción). Se usa `process.exit(1)` y no `throw` porque un throw ahí puede quedar atrapado por el servidor y dejar el proceso vivo — que es justo el defecto que se corrige.
- [x] 1b.2 Escribir la prueba que fija la guarda: arranque en producción sin configuración → falla; con configuración completa → arranca; en desarrollo sin configuración → arranca.
      Evidencia: 6 pruebas nuevas en `tests/storage.test.ts` (85 en total, eran 79). Cubren además que el error nombre **solo** la variable que falta cuando el resto está, y que una variable presente pero vacía cuente como faltante — un `.env` con `R2_BUCKET=` es un error de configuración, no una elección.
      Actualizada la prueba existente que afirmaba el mensaje anterior (`/Falta configurar R2/`), que este cambio dejaba obsoleta.
- [x] 1b.3 Verificarlo contra la imagen real: arrancar el contenedor en modo producción sin las variables y comprobar que **termina** en vez de responder HTTP 200 en `/login`, que es el comportamiento actual.
      Evidencia (tres casos contra `kora-app:guard-test`):
      · sin variables → contenedor `exited (exit 1)`, `/login` sin conexión (antes respondía HTTP 200), mensaje nombrando las 5 variables;
      · con las variables → `running`, `/` y `/catalogo` en HTTP 200;
      · faltando solo `R2_BUCKET` → el mensaje nombra `R2_BUCKET` y ninguna otra.
- [x] 1b.4 Confirmar que la afirmación de `CLAUDE.md` y del plan técnico ("en producción, sin R2 configurado la app falla al arrancar") pasó a ser cierta.
      Confirmado por el caso 1 de la tarea anterior. Ya no hay que corregir esos documentos: el código alcanzó lo que describían.

> **Bug de infraestructura encontrado y resuelto en el camino (1b.3).** La imagen dejó de construir: `next build` moría con `SIGKILL` al revisar tipos, porque Docker corre aquí sobre Colima con **1.9 GB y 2 CPUs**. La solución no fue darle más memoria sino quitar del build de la imagen algo que no le corresponde: el CI ya corre `typecheck`, `lint` y `test` **como compuerta antes** de construir (specs/continuous-deployment). Se activa con `DOCKER_BUILD=1`, que solo pone el `Dockerfile`, de modo que un `pnpm build` en la máquina de cualquiera conserva ambas revisiones.

## 2. Borde y página de espera

- [x] 2.1 Escribir `deploy/holding/index.html`: página autocontenida con el logotipo, los cinco textos aprobados, tokens de color y tipografía de `src/app/globals.css`, sin peticiones a terceros.
      Evidencia: página de 292 KB en total. Fuentes **alojadas localmente** (`fonts/Manrope-variable.woff2`, `fonts/Allura-400.woff2`, solo subconjunto latino) porque la spec prohíbe peticiones a terceros: enlazar Google Fonts habría filtrado cada visita y roto la página sin red hacia fuera. Manrope resultó ser fuente variable — un único archivo cubre los pesos 200–800.
- [x] 2.2 Revisar el texto publicado contra la lista de palabras prohibidas del brand book y confirmar que no hay formulario, número de teléfono ni enlace de mensajería.
      Evidencia (auditoría automatizada sobre el texto visible + metadatos, ignorando comentarios): 0 de 21 palabras prohibidas; sin fechas ni cuenta regresiva; sin `<form>`, `<input>`, `<textarea>`, `<button>`, `action=` ni `fetch`/`XHR`; sin números telefónicos ni enlaces de mensajería o redes; 0 recursos externos; todos los hex pertenecen a los tokens de marca.
- [x] 2.3 Verificar la página en ancho de teléfono: sin desplazamiento horizontal ni texto recortado.
      Evidencia (medición del DOM en 1440, 390 y 320 px): sin desborde horizontal en ninguno; ambas fuentes en estado `loaded`; ningún elemento fuera del viewport. En 320 px —el peor caso para `white-space: nowrap`— la firma ocupa 211 px de 320.
      Bugs corregidos en esta ronda, detectados al ver la página renderizada: (1) `en un solo lugar.` se partía en dos líneas, rompiendo la firma de marca; (2) `TODO LO QUE BUSCAS,` también se partía, por un `max-width` en `ch` de más; (3) `Pequeños detalles, grandes recuerdos.` dejaba una palabra huérfana.
- [x] 2.4 Escribir `deploy/Caddyfile` con las tres entradas de dominio, redirección de HTTP a HTTPS, y la unificación de `www` con el apex.
      Evidencia: `caddy validate` → *Valid configuration*. `www` responde 301 a `korashopp.com`; el apex sirve la página de espera con sus 3 recursos en HTTP 200 y los 6 textos aprobados presentes; `test.` redirige de HTTP a HTTPS con 308.
      El apex y `www` quedaron declarados como `http://` **a propósito** hasta que se repunte el DNS (ver 6.4): mientras el registro A apunte al parking del proveedor, la autoridad certificadora valida contra esa máquina y Caddy reintenta cada 60 s indefinidamente, gastando cuota sin obtener nada.
- [x] 2.5 Añadir al dominio de pruebas la autenticación básica y la cabecera de no indexación; generar el hash de la contraseña y dejarlo **fuera del repositorio**.
      Evidencia: sin credenciales → 401 con `WWW-Authenticate`; con credenciales correctas → 502 (el borde autentica y enruta; el stack de pruebas aún no existe); con credenciales incorrectas → 401. `X-Robots-Tag: noindex, nofollow, noarchive` presente en pruebas y **ausente** en el apex.
      El hash **no** pasa por variables de entorno: vive en `deploy/auth.caddy`, que solo existe en el servidor (plantilla versionada `auth.caddy.example`, archivo real en `.gitignore`).
- [x] 2.6 Escribir `deploy/docker-compose.edge.yml` con el proxy, sus dos redes de frontera, el volumen de certificados y el montaje de la página de espera.
      Evidencia: redes `kora-edge-staging` y `kora-edge-prod` creadas; contenedor `kora-caddy` arriba con límite de 128 MB y 0.5 CPU; volúmenes de certificados persistentes.
- [x] 2.7 Levantar el borde en el servidor usando el emisor de certificados de prueba y verificar el enrutamiento sin gastar cuota del emisor real.
      Evidencia: verificado primero contra la autoridad de pruebas y solo después cambiado a la real. Certificado vigente de Let's Encrypt para `test.korashopp.com` (emisor `CN=YE1`, válido hasta el 30 oct 2026), aceptado por el sistema sin `-k` (`ssl_verify_result 0`).

> **Tres bugs reales encontrados y corregidos en este bloque.** Ninguno era evidente leyendo la configuración; los tres aparecieron al verificar contra el servidor.
>
> 1. **Docker Compose mutila los hashes bcrypt.** Un hash empieza por `$2a$14$` y Compose interpreta esos `$` como referencias a variables: llegaba de **48 caracteres en vez de 60**, sin ningún aviso, y la autenticación rechazaba siempre —incluso con la contraseña correcta—. Se sacó la credencial de las variables de entorno a un archivo importado por Caddy, donde `$` es un carácter corriente.
> 2. **`-Server` hacía desaparecer todas las cabeceras de seguridad en las respuestas de error.** Cualquier operación de borrado obliga a Caddy a diferir el bloque `header` completo hasta que se escribe la respuesta, y en las respuestas que genera Caddy mismo (401, 502) ese diferido nunca se aplica. Se eliminó `-Server`: ocultar el nombre del servidor es cosmético; tener las cabeceras siempre, incluso en los errores, no lo es.
> 3. **Una variable de entorno vacía tumba el borde entero.** `{$VAR:default}` de Caddy usa el valor por defecto solo si la variable **no existe**; vacía sustituye cadena vacía, `acme_ca` se queda sin argumento y el contenedor entra en bucle de reinicios — con los dos entornos caídos a la vez. Se documentó en la plantilla que la variable siempre lleva una URL explícita, y se incorporó `caddy validate` **antes** de reiniciar como paso obligatorio.

## 3. Entorno de pruebas

- [x] 3.1 Escribir `deploy/docker-compose.staging.yml`: aplicación, PostgreSQL y Redis en su red interna, con los límites de memoria y CPU de la tabla del diseño.
      Evidencia: los tres contenedores arriba, PostgreSQL y Redis en estado `healthy`. La base **no publica ningún puerto** al servidor; su red lleva `internal: true`, sin salida a internet.
- [x] 3.2 Escribir `.env.staging.example` con todas las variables requeridas y ningún valor real; crear el archivo efectivo en el servidor y guardar sus secretos en el gestor de contraseñas.
      Evidencia: `.env.staging` con permisos 600, contraseña de base y secreto de sesión generados al azar y **distintos de los que tendrá producción**. Las contraseñas se generan sin `$` a propósito (ver bug de abajo).
- [x] 3.3 Levantar el entorno, aplicar migraciones con un contenedor efímero y cargar los datos de demostración.
      Evidencia: *All migrations have been successfully applied*; seed con 29 permisos, 4 roles, 4 categorías, 20 productos, 27 variantes y 27 movimientos de inventario.
- [x] 3.4 Pasar el emisor de certificados al definitivo y verificar `https://test.korashopp.com` con certificado válido y solicitud de autenticación.
      Evidencia: certificado de Let's Encrypt válido hasta el 30 oct 2026, aceptado sin excepciones (`ssl_verify_result 0`). Autenticación exigida antes de entregar contenido.
- [ ] 3.5 Recorrer el flujo de venta completo contra el entorno de pruebas —catálogo, ficha, carrito, pago, pedido, confirmación en el panel— y registrar qué difiere respecto a local.
      **Parcial.** Verificado que `/`, `/catalogo`, `/login`, `/carrito` y `/checkout` responden HTTP 200 a través del borde, que el catálogo sirve productos leídos de su propia base (`[DEMO] Correa de reloj intercambiable`, …) y que `/admin` redirige al login con 307. **Falta** recorrer una compra completa hasta el pedido confirmado: es la auditoría manual que exige la compuerta de aceptación del proyecto.

> **Dos bugs más, de la misma familia que los del bloque 2.**
>
> 4. **Arquitectura equivocada.** Las imágenes construidas en el equipo de desarrollo (Apple Silicon, **arm64**) no pueden ejecutarse en el VPS (**x86_64**). Se detectó comparando `docker image inspect` antes de arrancar nada; de lo contrario habría dado un bucle de reinicios con `exec format error`, de los más confusos de diagnosticar. Sin `buildx` en el equipo no hay compilación cruzada, así que el arranque inicial se construyó **en el propio servidor** — excepción puntual y consciente a la decisión 1 del diseño, que desaparece cuando el CI (bloque 5) tome el relevo: los ejecutores de GitHub Actions son x86_64.
> 5. **`${VAR}` dentro de un compose NO lee de `env_file`.** Lee del shell o de un archivo llamado exactamente `.env`. `POSTGRES_PASSWORD` llegaba vacío y PostgreSQL se negaba a inicializar. Se pasó a `env_file` en el propio servicio y `$$VAR` en la comprobación de salud, de modo que funcione sin depender de recordar ningún flag. Es la **tercera** vez en este change que la interpolación de `$` de Docker Compose muerde: quedó anotado en las plantillas.
>
> **Nota menor:** Prisma emite un aviso sobre OpenSSL al ejecutar el seed. Es cosmético — la versión 7 con adaptadores de driver no usa el motor nativo que lo necesitaría — y el seed termina correctamente.

## 4. Verificación del aislamiento

- [x] 4.1 Demostrar que desde un contenedor de pruebas el servicio de base de datos de producción **no resuelve** (fallo de red, no de credenciales) y dejar la salida como evidencia.
      Evidencia: desde `kora-staging-app`, `getent hosts kora-prod-postgres` **no resuelve**. Las dos bases viven en subredes distintas: producción en `172.21.0.2`, pruebas en `172.20.0.3`.
- [x] 4.2 Demostrar que la cadena de conexión de producción usada desde pruebas tampoco conecta.
      Evidencia: conexión TCP directa a `172.21.0.2:5432` desde `kora-staging-app` → **tiempo agotado**, fallo de red y no de autenticación. Con **prueba de control**: la misma comprobación contra su propia base (`172.20.0.3`) sí conecta, lo que demuestra que la prueba distingue de verdad.
      ⚠️ La primera versión de esta prueba era inválida y daba un falso positivo alarmante: ambos entornos nombran su base `postgres`, así que la cadena de producción ejecutada desde pruebas resuelve a **la base de pruebas** y "conecta" sin que nada se haya cruzado. Solo la prueba por IP directa, con control, responde a la pregunta.
- [x] 4.3 Listar los volúmenes de ambos entornos y confirmar que ninguno está referenciado por los dos.
      Evidencia: `kora-staging_pgdata`, `kora-staging_redisdata`, `kora-prod_pgdata`, `kora-prod_redisdata` — ninguno referenciado por contenedores de los dos entornos.
- [x] 4.4 Sumar los límites de memoria declarados, confirmar que dejan el margen previsto para el sistema operativo.
      Evidencia: **5.376 MB comprometidos** de 7.940 MB físicos → **2.564 MB de margen**. Coincide con lo estimado en el diseño (≈5.4 GB / ≈2.4 GB). Falta trasladar la tabla a `deploy/README.md` (tarea 7.1).
- [x] 4.5 Confirmar que las credenciales efectivas de ambos entornos no coinciden en ningún valor sensible.
      Evidencia: `POSTGRES_PASSWORD`, `AUTH_SECRET` y `DATABASE_URL` distintos entre `.env.staging` y `.env.production`.
- [x] 4.6 Detener el entorno de pruebas por completo y verificar que el dominio comercial sigue respondiendo.
      Evidencia: con los 3 contenedores de pruebas detenidos, el apex siguió respondiendo HTTP 200 y `test.korashopp.com` devolvió 502 (el borde vivo, el entorno caído). Restaurado, vuelve a 200.

## 5. Despliegue continuo

- [ ] 5.1 Generar el par de llaves dedicado al despliegue, autorizarlo en el servidor y confirmar que la llave personal del desarrollador **no** queda en los secretos del repositorio.
- [ ] 5.2 Cargar los secretos del repositorio (llave de despliegue, servidor, credenciales del registro) y verificar la conexión desde un ejecutor de la integración continua.
- [ ] 5.3 Añadir al flujo de trabajo el trabajo de construcción y publicación de la imagen, etiquetada con el hash del commit, condicionado a que la verificación completa haya pasado.
- [ ] 5.4 Añadir el trabajo de despliegue a pruebas: descargar la imagen, aplicar migraciones en contenedor efímero y recrear la aplicación solo si las migraciones terminaron bien.
- [ ] 5.5 Verificar el camino de fallo: integrar un cambio con una prueba rota y confirmar que **no se despliega** y que el entorno conserva la versión anterior.
- [ ] 5.6 Verificar el camino feliz: integrar un cambio real y confirmar que el entorno de pruebas queda actualizado sin intervención.
- [ ] 5.7 Añadir el trabajo de despliegue a producción con aprobación manual obligatoria y comprobar que queda detenido esperando autorización.
- [ ] 5.8 Verificar la reversión: desplegar la etiqueta anterior y confirmar que el entorno vuelve a la versión previa.

## 6. Entorno de producción (sin publicar)

- [x] 6.1 Escribir `deploy/docker-compose.prod.yml` y `.env.production.example` con el presupuesto de recursos de producción.
      Evidencia: app 1536 MB, base 1536 MB, caché 256 MB. Sin tope duro de CPU en producción a propósito: con 2 núcleos, un tope impediría usar la capacidad que pruebas deja ociosa; el reparto lo impone el tope de pruebas.
- [x] 6.2 Levantar producción **sin publicarla**, alcanzable solo por vía interna, y confirmar que arranca con migraciones aplicadas.
      Evidencia: base y caché de producción en estado `healthy`, migraciones aplicadas sobre su propia base. **La aplicación queda detenida a propósito** hasta que exista la cuenta de Cloudflare R2 — ver tarea siguiente.
- [x] 6.3 Confirmar en el servidor real que sin las variables de almacenamiento de imágenes la aplicación **falla al arrancar** gracias a la guarda del bloque 1-bis.
      Evidencia: `kora-prod-app` queda en `restarting (exit 1)` con el mensaje nombrando las cinco variables. La guarda funciona en el servidor real, no solo en pruebas de laboratorio.
- [x] 6.4 Repuntar el apex y `www` al servidor y verificar que sirven la página de espera con certificado válido, con la aplicación de producción detenida.
      Hecho el **1 ago 2026**. Evidencia: `https://korashopp.com` responde HTTP 200 con certificado de Let's Encrypt (`CN=korashopp.com`, válido hasta el 30 oct 2026) y `ssl_verify_result 0`; los 6 textos aprobados y los 3 recursos (logo y dos fuentes) en 200; `http://` redirige con 308 a HTTPS y `www` con 301 al apex. La aplicación de producción sigue **detenida**, lo que confirma que la página de espera no depende de ella.
      Nota operativa: Hostinger rechaza TTL menores de 60 al editar un registro, aunque su propio sistema tuviera 50. Quedó en 60.

## 7. Documentación y cierre

- [ ] 7.1 Escribir `deploy/README.md`: reconstrucción del servidor desde cero, inventario de lo que vive solo en la máquina, presupuesto de memoria y procedimiento de reversión.
- [ ] 7.2 Reconstruir mentalmente el procedimiento contra el estado real del servidor y corregir todo paso que no esté escrito o no funcione tal como está redactado.
- [ ] 7.3 Actualizar `.env.example` con las variables nuevas del entorno servidor.
- [ ] 7.4 Registrar en `../notas-tecnicas-privado.md` las deudas asumidas: PgBouncer diferido con su disparador, ausencia de copias de imagen del servidor, reinicio con corte durante el despliegue, y la contraseña de pruebas como barrera de confusión y no como control de seguridad.
- [ ] 7.5 Anotar en `../bitacora-sprints-kora.md` el cierre del pendiente de staging del DoD de la Semana 1, con la evidencia, y dejar declarado que el respaldo cifrado bloquea el go-live.
- [ ] 7.6 Correr `pnpm typecheck && pnpm lint && pnpm build && pnpm test` y dejarlos en verde.

> **Bug 6 · comprobación de salud del borde mal escrita.** `kora-caddy` figuraba como `unhealthy` estando perfectamente sano: la comprobación pedía `127.0.0.1:80` **sin cabecera Host**, Caddy respondía 308 hacia HTTPS y contra una IP no hay certificado. Un contenedor marcado como enfermo puede ser reiniciado por la orquestación y envenena cualquier monitoreo futuro. Se cambió a la API de administración (`127.0.0.1:2019/config/`), que además no se romperá cuando el apex pase de `http://` a `https://` en el go-live. Verificado: `healthy`.

> **Bug 8 · un bind mount de archivo único apunta al inodo, no a la ruta.** Al subir el `Caddyfile` con `tar`, este **reemplaza** el archivo creando uno nuevo, y el montaje del contenedor siguió apuntando al inodo viejo: `caddy reload` recargó la configuración **anterior** sin error alguno, y el apex se quedó sin HTTPS pareciendo que todo había funcionado. Se detectó comparando el contenido del archivo en el host y dentro del contenedor. Regla que queda: **tras modificar cualquier archivo montado individualmente hay que recrear el contenedor** (`up -d --force-recreate`), no basta con recargar. Debe ir al `deploy/README.md` (tarea 7.1).
