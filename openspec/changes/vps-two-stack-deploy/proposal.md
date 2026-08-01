# Despliegue de dos entornos en el VPS propio

**Semana del plan:** cierra la deuda pendiente del **DoD de S1** — *"Staging accesible por HTTPS en subdominio, con CI desplegando desde `main`"* — y prepara el terreno de **S16 (producción, go-live 30 oct)**.

**HUs asociadas:** **ninguna**. Las historias de usuario del proyecto (`../hus-*.md`, tablero Notion) cubren comportamiento de producto, no infraestructura. Este change no traza contra ningún código de HU y no inventa requisitos funcionales: sus requisitos salen del plan técnico (§3 Stack, §5 DoD S1) y de decisiones de operación tomadas el 31 jul 2026.

## Why

Desde el 11 de julio el proyecto corre **solo en local**. El DoD de la Semana 1 exigía staging vivo con HTTPS y CI desplegando; nunca se cumplió porque dependía de accesos SSH y DNS del cliente que no llegaron, y el hito cara al cliente de "enlace navegable en S3" venció el 31 de julio sin entregarse. Mientras tanto se acumularon **cinco semanas de funcionalidad sin desplegar** (S1–S5, S7, S8 y el módulo Vitrina): todo verificado en la máquina de desarrollo y nada probado en un entorno real.

El 31 de julio se eliminó la dependencia: se aprovisionó un **VPS propio** (Ubuntu 24.04, 2 vCPU / 8 GB / 96 GB) y se usará el dominio propio `korashopp.com`. El servidor ya quedó endurecido y con Docker instalado. Falta lo que convierte esa máquina en un entorno: contenedorizar la aplicación, levantar los dos stacks, ponerles un proxy con TLS y conectar el despliegue automático.

Se resuelve ahora y no más adelante porque **cada semana sin staging es una semana de riesgo acumulado**: diferencias entre local y servidor, migraciones nunca ejecutadas fuera de desarrollo y un cliente que todavía no ha visto nada funcionando. Además, el dominio comercial muestra hoy una página de parking genérica de Hostinger — un activo de marca sirviendo publicidad de un proveedor.

## What Changes

- **Contenedorización de la aplicación (nuevo).** No existe `Dockerfile` en el repositorio: la aplicación nunca se ha empaquetado. Se añade un build multi-etapa y `output: "standalone"` en `next.config.ts` para producir una imagen delgada.
- **Dos entornos sobre una sola máquina.** Stacks independientes `kora-staging` y `kora-prod`, cada uno con su PostgreSQL 16, Redis, PgBouncer y aplicación, en redes Docker y volúmenes separados. Staging no puede alcanzar la base de producción por ninguna ruta.
- **Presupuesto de recursos explícito.** Límites de CPU y memoria por contenedor, con producción priorizada: un staging desbocado no puede degradar la tienda real.
- **Caddy único como borde.** Un solo contenedor en 80/443 enruta por dominio hacia el stack correspondiente y emite TLS automáticamente.
- **Staging cerrado al público.** `test.korashopp.com` responde con `X-Robots-Tag: noindex` y exige autenticación básica: no se indexa y no se confunde con la tienda real.
- **Página de espera de marca en el dominio comercial.** Reemplaza la página de parking de Hostinger por una página estática con la identidad de KORA. Se sirve desde Caddy como archivo estático, no desde Next.js, para que no dependa de que la aplicación esté arriba.
- **Despliegue continuo real.** Hoy `.github/workflows/ci.yml` solo tiene un bloque comentado con un `TODO`; no hay job de despliegue. Se implementa: `main` despliega a staging sin intervención, producción exige aprobación manual.
- **Migraciones en el despliegue.** `prisma migrate deploy` corre como paso del despliegue, nunca a mano contra el servidor.
- **La aplicación se niega a arrancar con configuración de almacenamiento incompleta** *(añadido el 31 jul, ver abajo)*. Hoy la comprobación es perezosa: sin las variables del almacenamiento de imágenes la aplicación arranca, responde el inicio de sesión, y solo falla cuando alguien visita una página con imágenes. Pasa a verificarse al arranque.

### Ampliación de alcance — 31 jul 2026

Durante la implementación se comprobó que **el `CLAUDE.md` del repositorio y el plan técnico afirman algo que no es cierto**: que en producción, sin el almacenamiento de imágenes configurado, "la aplicación falla al arrancar". Con `NODE_ENV=production` y sin esas variables, el contenedor arranca correctamente y `/login` responde HTTP 200; solo devuelve HTTP 500 al renderizar una página que resuelve URLs de imágenes.

**Por qué se corrige aquí y no después:** en el go-live el contenedor se reportaría **sano** —pasaría cualquier verificación de salud— con la tienda rota, y el fallo aparecería cuando entrara el primer cliente en vez de cuando se despliega. Un despliegue que dice haber funcionado sobre una tienda que no funciona es peor que un despliegue que falla, porque nadie va a estar mirando.

Es el **único añadido de lógica en `src/`** de este change; todo lo demás sigue siendo infraestructura. Si por alguna razón no se implementara, entonces habría que corregir la afirmación en `CLAUDE.md` y en el plan técnico, que hoy describen un comportamiento que el sistema no tiene.

## Capabilities

### New Capabilities

- `environment-isolation`: dos entornos conviviendo en una máquina sin contaminarse — separación de datos, red y credenciales, y reparto acotado de CPU y memoria.
- `edge-routing`: el borde HTTP — terminación TLS automática, enrutamiento por nombre de dominio hacia el stack correcto, y protección de staging contra indexación y acceso público.
- `holding-page`: la página de espera del dominio comercial mientras producción no existe, con la voz y la identidad de la marca.
- `continuous-deployment`: construcción de la imagen, publicación y despliegue desde GitHub Actions, con migraciones aplicadas y promoción a producción bajo aprobación manual.

### Modified Capabilities

Ninguna. `openspec/specs/` está vacío: este es el primer change del proyecto bajo OpenSpec y no modifica requisitos previamente especificados.

## Fuera de alcance

Se declara explícitamente para defender la fecha:

- **Repuntar `korashopp.com` y `www` a la aplicación real.** El registro `A` del apex sigue en la página de parking hasta que exista la página de espera, y la tienda de producción solo recibe tráfico en el **go-live del 30 oct**. Este change deja producción montada y accesible por una vía interna, no publicada.
- **Respaldo cifrado de base de datos.** Al descartarse los snapshots pagos del proveedor por presupuesto, el `pg_dump` diario cifrado con retención de 30 días pasa de ser una tarea cómoda de S16 a ser la **única capa de respaldo del proyecto**. Merece su propio change (`encrypted-db-backup`) y está **bloqueado**: la cuenta de Cloudflare R2 todavía no existe. **Fecha límite innegociable: debe estar construido y con su restauración probada antes del go-live del 30 oct.**
- **Worker de la cola de eventos** (`order.confirmed` sigue acumulándose en `domain_events`) y **cron de expiración de pedidos**: van en sus propios changes, ya identificados como los pendientes técnicos #1 y #2.
- **Observabilidad** (Sentry, Uptime Kuma) y **prueba de carga k6**: pertenecen a S15.
- **Detección de moneda por GeoIP.** Sin configurar; todo visitante nuevo seguirá viendo COP, que es el respaldo previsto por la historia de usuario.

## Bloqueos declarados

| Bloqueo | Qué impide | De quién depende |
|---|---|---|
| **Cuenta de Cloudflare R2 inexistente** | En producción la aplicación **falla al arrancar** sin sus variables — es una decisión deliberada para que el servidor nunca sirva imágenes. Producción no puede levantar hasta resolverlo. | Nosotros |
| **Número de WhatsApp comercial sin confirmar** | Por eso la página de espera **no lleva ningún canal de contacto**: publicar el número del prototipo es peor que no publicar ninguno. | Cliente |
| **Catálogo Excel y fotos reales** | Staging se puebla con datos de demostración; el entorno queda listo pero sin cara real. | Cliente |
| **Tipografía "KORA Custom"** | El brand book titula en una serif que no tenemos. La página de espera usa los tokens vigentes de `globals.css`. | Cliente |

Ninguno de estos bloqueos impide construir este change: los cuatro afectan contenido o producción publicada, no la infraestructura ni staging.

## Impact

**Archivos nuevos**
- `Dockerfile`, `.dockerignore`
- `deploy/docker-compose.prod.yml`, `deploy/docker-compose.staging.yml`, `deploy/docker-compose.edge.yml`
- `deploy/Caddyfile`
- `deploy/holding/index.html` y los recursos de marca que necesite
- `deploy/README.md` — cómo se reconstruye el servidor desde cero
- `.env.production.example`, `.env.staging.example`

**Archivos modificados**
- `next.config.ts` — `output: "standalone"`
- `.github/workflows/ci.yml` — se implementan los jobs de despliegue que hoy son un comentario
- `.env.example` — variables nuevas del entorno servidor
- `src/modules/storage/` — la comprobación de configuración pasa de perezosa a verificarse al arranque (único cambio de lógica del change)
- `tests/` — prueba nueva que fija esa guarda

**Sistemas afectados**
- **DNS de `korashopp.com`**: `test` ya apunta al VPS; el apex y `www` no se tocan en este change.
- **GitHub Actions**: nuevos secretos de repositorio (llave SSH de despliegue, credenciales del registro de imágenes). Se genera un par de llaves dedicado; la llave personal del desarrollador nunca entra a los secretos.
- **VPS**: pasa de máquina endurecida y vacía a servidor con dos entornos corriendo.

**Sin impacto**
- No hay migraciones de esquema nuevas: el change no toca el modelo de datos.
- No toca el motor de inventario, precios, permisos ni estados de pedido — ninguna regla innegociable del proyecto se ve afectada.

**Riesgo asumido**
Sin snapshots del proveedor, la recuperación ante un fallo del servidor depende de que **todo sea reconstruible desde el repositorio**. Por eso la configuración de despliegue se versiona completa y lo único que existe solo en la máquina son los archivos `.env` con secretos, custodiados aparte.
