# Despliegue de KORA

Dos entornos sobre **una sola máquina**. Este directorio contiene todo lo necesario para reconstruirla desde cero.

> **Esto no es documentación de cortesía.** Se descartaron por presupuesto las copias de imagen del proveedor, así que **reconstruir desde este repositorio es la única vía de recuperación** ante un fallo total del servidor. Lo único que existe solo en la máquina son los archivos `.env*` con secretos y los datos de las bases.

## El mapa

```
                        internet
                            │
                     ┌──────┴──────┐
                     │  kora-caddy │  80 · 443 · TLS automático
                     └──┬───────┬──┘
          edge-staging  │       │  edge-prod
                        │       │
              kora-staging-app  kora-prod-app
                        │       │
        kora-staging-interna    kora-prod-interna   ← sin salida a internet
           postgres · redis     postgres · redis    ← sin puertos publicados
```

| | Dominio | Estado |
|---|---|---|
| **Pruebas** | `test.korashopp.com` | Autenticación básica + `noindex` |
| **Producción** | `korashopp.com` · `www` | Página de espera hasta el go-live del 30 oct |

**Las dos aplicaciones no comparten ninguna red.** Solo hablan con el borde. Desde pruebas, la base de producción **no resuelve** y su IP es inalcanzable: el aislamiento es de topología, no de contraseñas.

## Presupuesto de memoria

Servidor: 2 vCPU · 7.940 MB.

Tres imágenes salen del mismo `Dockerfile`, por objetivos distintos: `runner` (la aplicación), `migrator` (aplica migraciones y termina) y `worker` (consume la bandeja de salida de eventos). El worker **no puede** salir de `runner`: esa es la salida *standalone* de Next y no lleva `tsx` ni `scripts/`.

| Servicio | Memoria | CPU |
|---|---:|---|
| `kora-caddy` | 128 MB | 0.5 |
| `kora-prod-app` | 1.536 MB | sin tope |
| `kora-prod-postgres` | 1.536 MB | sin tope |
| `kora-prod-redis` | 256 MB | sin tope |
| `kora-prod-worker` | 384 MB | sin tope |
| `kora-staging-app` | 1.024 MB | 1.0 |
| `kora-staging-postgres` | 768 MB | 1.0 |
| `kora-staging-redis` | 128 MB | 0.5 |
| `kora-staging-worker` | 256 MB | 1.0 |
| **Comprometido** | **6.016 MB** | |
| **Margen libre** | **1.924 MB** | |

**Producción no lleva tope de CPU a propósito:** con solo 2 núcleos, un tope le impediría usar la capacidad que pruebas deja ociosa. El reparto lo impone el tope de pruebas. El margen libre no sobra: PostgreSQL depende del caché de disco del sistema operativo para su rendimiento de lectura.

## Reconstrucción desde cero

Sobre un Ubuntu 24.04 recién aprovisionado:

**1. Endurecer el acceso** — usuario `deploy` no-root con sudo, llave pública autorizada, `PermitRootLogin no`, `PasswordAuthentication no`, `AllowUsers deploy`, `ufw` con solo 22/80/443, `fail2ban` y `unattended-upgrades`.

> ⚠️ Ubuntu trae `/etc/ssh/sshd_config.d/50-cloud-init.conf` con `PasswordAuthentication yes`. En SSH **gana la primera ocurrencia**, así que un archivo `99-` no sirve de nada: el servidor se ve endurecido y sigue aceptando contraseñas. Usar prefijo `00-`, corregir el de cloud-init y poner `ssh_pwauth: false` en `/etc/cloud/cloud.cfg.d/`.

**2. Docker** desde el repositorio oficial (no el paquete de Ubuntu), y las herramientas del respaldo:
```bash
sudo apt-get install -y age rclone
```
> Estos dos viven **fuera** del `docker compose`. Reconstruir el servidor sin ellos deja el sistema **sin copias de seguridad y sin decirlo**. Ver [`backup/README.md`](backup/README.md).

**3. Redes:**
```bash
docker network create kora-edge-staging
docker network create kora-edge-prod
```

**4. Archivos:** copiar este directorio a `~/kora/deploy/` y crear desde las plantillas:
- `.env.edge` ← `.env.edge.example`
- `auth.caddy` ← `auth.caddy.example`
- `.env.staging` ← `.env.staging.example`
- `.env.production` ← `.env.production.example`

**5. Levantar:**
```bash
cd ~/kora/deploy
docker compose -f docker-compose.edge.yml up -d
docker compose --env-file .env.staging    -f docker-compose.staging.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml   up -d
docker compose --env-file .env.staging -f docker-compose.staging.yml run --rm migrate
```

**6. DNS:** registros `A` de `@` y `test` → IP del servidor; `CNAME www` → apex.

## Despliegue

Desde GitHub Actions. **En cada integración solo corre la verificación** — no se despliega ni se construyen imágenes. El entorno de pruebas se despliega **cada noche a las 02:00 (Colombia)** y **bajo petición** desde `Actions → CI → Run workflow`. **Producción** solo bajo petición y con aprobación humana.

Desplegar en cada commit convierte el entorno de pruebas en un blanco móvil: cambia bajo los pies de quien lo está probando.

```
cada push:     verificación
cada noche:    verificación → imágenes → configuración → pruebas
bajo petición: lo mismo, y opcionalmente producción (con aprobación)
```

**El despliegue lleva imágenes Y configuración.** Los archivos de este directorio se copian al servidor en cada despliegue, así que una corrección del compose o del `Caddyfile` llega sola. Los `.env.*` y `auth.caddy` reales **no se tocan**: viven únicamente en el servidor.

> ⚠️ Durante el montaje inicial esto no era así y costó un rato entenderlo: el flujo solo llevaba imágenes, la configuración se había subido a mano, y las correcciones del repositorio no tenían ningún efecto en el servidor. Un servidor que no recibe su configuración desde el repositorio **no es reconstruible desde el repositorio**, por mucho que los archivos estén versionados.

Secretos del repositorio: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`. La credencial del registro es **efímera**, del propio flujo: no queda ninguna permanente en el servidor.

> ⚠️ **`environment: production` por sí solo NO exige aprobación.** Sin reglas de protección, GitHub ejecuta el trabajo directo aunque el YAML declare el entorno. La aprobación humana la impone marcar **`Required reviewers`** en `Settings → Environments → production`. Sin ese checkbox el requisito de la spec no se cumple, y nada en el repositorio lo delata.

**Revertir:** volver a levantar la etiqueta anterior. El historial está en `~/kora/deploy/historial-despliegues.tsv`.

```bash
cd ~/kora/deploy
sed -i 's|^KORA_IMAGE=.*|KORA_IMAGE=ghcr.io/dangk20/kora-app/app:<etiqueta>|' .env.staging
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --no-deps --force-recreate app
```

Las migraciones **no** se revierten solas: se asume compatibilidad hacia atrás del esquema. Una migración destructiva exige plan propio.

## El entorno de PRUEBAS no envía correo, y es a propósito

`.env.staging` lleva dos variables que producción NO tiene:

```
KORA_ENV=staging
EMAIL_DEV_DIR=/emails
```

Con ellas, la aplicación **arranca sin proveedor de correo** y el worker
**escribe los correos a disco** en vez de enviarlos. Para leerlos:

```bash
docker exec kora-staging-worker ls -t /emails | head
docker exec kora-staging-worker cat /emails/<archivo>.eml
```

Dos motivos, y el segundo pesa más que el primero:

1. La imagen se compila **una sola vez** con `NODE_ENV=production` y se usa en
   los dos entornos. Sin `KORA_ENV`, la guarda que impide arrancar sin proveedor
   —que en producción es correcta— tumbaría también pruebas.
2. **Un entorno de pruebas que enviara de verdad le escribiría a direcciones de
   clientes reales** mientras alguien ensaya un pedido. Que no salga no es una
   limitación: es lo que debe pasar.

`KORA_ENV` sin definir se comporta como producción. Si alguien monta un entorno
nuevo y lo olvida, la guarda protege en vez de callarse.

**Esa convención la lee una sola función**, `esProduccion()` en
`src/lib/environment.ts`. La consumen la guarda del correo y el `robots.txt`.
Si alguna vez se invierte el criterio —que producción se declare y pruebas
calle— se cambia ahí y en `.env.production`, no en cada módulo que pregunte.

## Las imágenes de producto viven en el VPS, detrás del CDN

**Se revirtió la decisión del plan técnico §3** (almacenamiento remoto obligatorio). Cloudflare R2 exige registrar una tarjeta aunque su plan sea gratuito, y esa exigencia tenía producción parada desde el 1 de agosto. El VPS tiene 96 GB y 1.000 productos con fotos ocupan ~1,2 GB: la capacidad nunca fue el problema.

```
KORA_STORAGE_DRIVER=disk
KORA_UPLOADS_DIR=/data/uploads
```

Los dos reparos que justificaban el almacenamiento externo están resueltos:

- **Ancho de banda** → el CDN gratuito de Cloudflare va delante y el VPS entrega cada imagen **una vez** (`/media/*` sale con `Cache-Control: immutable` de un año).
- **Quedaban fuera del respaldo** → ya no: entran en el **mismo archivo cifrado** que la base (`backup/README.md`).

### ⚠️ El volumen no es opcional

`/data/uploads` **tiene** que ser un volumen. Sin él, las imágenes viven en la capa efímera del contenedor: se escriben sin error y `up -d --force-recreate` **las borra todas**, dejando la tienda con el catálogo completo y ninguna foto — un catálogo que el cliente cargó a mano.

Por eso la aplicación **lo comprueba al arrancar**: si la base registra imágenes y el directorio está vacío, el proceso termina con error en vez de servir una tienda rota. Es la misma lección que R2, el correo y los datos del comerciante.

### DNS en Cloudflare (tarea pendiente, gratuita y sin tarjeta)

El plan gratuito de DNS/CDN de Cloudflare **no pide tarjeta** — la pide R2, que es otro producto.

1. Crear cuenta en Cloudflare y añadir `korashopp.com`.
2. Cambiar los nameservers en Hostinger por los que indique Cloudflare.
3. Dejar `@`, `www` y `test` en **proxy activado** (nube naranja).
4. SSL/TLS en modo **Full (strict)** — Caddy ya sirve un certificado válido.

Sin este paso el sistema funciona igual, solo que el VPS sirve cada imagen cada vez. Es rendimiento, no corrección.

### Volver a R2 el día que haya tarjeta

`KORA_STORAGE_DRIVER=r2` con sus cinco credenciales, y copiar los archivos al bucket. Las claves guardadas en la base **no cambian de formato**, así que ninguna fila hay que reescribir.

## Producción no arranca sin los datos del comerciante

`.env.production` **debe** llevar estas cuatro, o el contenedor termina al
arrancar y el despliegue revierte solo:

```
KORA_LEGAL_RAZON_SOCIAL=
KORA_LEGAL_NIT=
KORA_LEGAL_DOMICILIO=
KORA_LEGAL_EMAIL=
```

Identifican al responsable del tratamiento en `/legal/datos-personales`, que es
la política a la que apunta la autorización que el checkout le pide al
comprador. Publicarlas con marcadores no deja un texto incompleto: deja un
consentimiento que no dice a quién se le entregan los datos, y que por tanto no
acredita nada ante la SIC (Ley 1581/2012, art. 9).

Es el mismo criterio que R2 y que el proveedor de correo, y por el mismo motivo:
**el fallo no da error en ninguna pantalla**. Sin la guarda, la tienda vendería
durante semanas con una política inválida y nadie lo notaría hasta que llegue
un requerimiento.

En pruebas no hace falta configurarlas: el entorno se declara `KORA_ENV=staging`,
la guarda no aplica y las páginas muestran marcadores entre corchetes,
deliberadamente feos para que salten a la vista.

## Trampas que ya nos costaron tiempo

Ocho fallos reales encontrados montando esto. Ninguno era visible leyendo la configuración; todos aparecieron al verificar contra el servidor.

**1 · Un bind mount de archivo único apunta al inodo, no a la ruta.** Subir el `Caddyfile` con `tar` lo *reemplaza*, y el contenedor sigue leyendo el archivo viejo. `caddy reload` recarga la configuración anterior **sin error alguno**. → Tras tocar cualquier archivo montado individualmente, **recrear el contenedor** (`up -d --force-recreate`); recargar no basta.

**2 · Docker Compose se come los `$`.** Un hash bcrypt (`$2a$14$…`) llega truncado de 60 a 48 caracteres, sin aviso, y la autenticación rechaza siempre. → Por eso la credencial de pruebas vive en `auth.caddy` y no en una variable de entorno. **Ninguna contraseña de estos archivos puede contener `$`.**

**3 · `${VAR}` dentro de un compose NO lee de `env_file`.** Lee del shell o de un archivo llamado exactamente `.env`. → Las variables de servicio van por `env_file`; en las comprobaciones de salud se escribe `$$VAR` para que las resuelva el shell del contenedor.

**4 · Una variable vacía tumba el borde entero.** `{$VAR:default}` de Caddy usa el valor por defecto solo si la variable **no existe**; vacía deja `acme_ca` sin argumento y el contenedor entra en bucle de reinicios. → `KORA_ACME_CA` siempre lleva una URL explícita. **Validar antes de reiniciar:** `docker exec kora-caddy caddy validate --config /etc/caddy/Caddyfile`.

**5 · `-Server` borra las cabeceras de seguridad en las respuestas de error.** Cualquier borrado obliga a Caddy a diferir el bloque `header` hasta escribir la respuesta, y en los 401/502 que genera Caddy mismo ese diferido no llega a aplicarse. → Sin `-Server`.

**6 · Comprobar la salud del borde contra el puerto 80 falla.** Sin cabecera Host válida, Caddy responde 308 hacia HTTPS y contra una IP no hay certificado. → Se comprueba contra la API de administración (`:2019/config/`).

**7 · La red interna no tiene salida a internet.** `pnpm <binario>` consulta el registro de npm antes de ejecutar. → El migrador invoca `./node_modules/.bin/prisma` directamente.

**8 · Arquitectura.** Una imagen construida en Apple Silicon (arm64) no arranca en el servidor (x86_64) — da `exec format error`, difícil de diagnosticar sin sospecharlo. → Las imágenes las construye el CI, que es x86_64. Comprobar con `docker image inspect <img> --format '{{.Architecture}}'`.

## Trabajos programados

Los ejecuta el propio worker, en el mismo proceso que consume la bandeja de salida — no hay contenedor aparte.

| Trabajo | Cadencia | Qué hace |
|---|---|---|
| `orders:expire` | 5 min | Cancela los pedidos pendientes que superaron su vigencia de 2 h |
| `ledger:verify` | Diario | Comprueba que `stockActual` cuadra con la suma de movimientos. **Avisa, no corrige**: un libro descuadrado es un síntoma y corregirlo borra la evidencia |
| `outbox:status` | 15 min | Vigila que la bandeja de eventos no se atasque |

```bash
pnpm jobs:status     # última ejecución con éxito de cada uno, y si van atrasados
pnpm outbox:status   # estado de la bandeja de eventos
```

**La señal que importa no es "falló", es "lleva demasiado sin correr".** Un trabajo programado no se cae ruidosamente: se apaga en silencio, y el daño se ve semanas después. Por eso `jobs:status` termina con código distinto de cero cuando algo va atrasado — para poder encadenarlo a una comprobación automática el día que haya canal de alertas.

Desactivar el programador sin tocar el consumo de eventos: `JOBS_SCHEDULER=off`.

## Certificados

Los emite y renueva Caddy solo. Persisten en el volumen `kora-edge_caddy_data`: **no borrarlo** o se vuelven a solicitar en cada recreación y se agota la cuota del emisor (5 por dominio a la semana).

Mientras se ajusta el enrutamiento, apuntar `KORA_ACME_CA` a la autoridad de **pruebas** — emite certificados que el navegador no reconoce, pero sin cuota práctica.

## Respaldos

**Construidos y verificados en local (7 ago); falta instalarlos en el VPS.** Se descartaron los snapshots del proveedor por presupuesto, así que el `pg_dump` diario cifrado con retención de 30 días **es la única capa de respaldo del proyecto**.

El procedimiento completo —generación y custodia de claves, instalación, `cron`, y la recuperación ante desastre paso a paso— vive en **[`backup/README.md`](backup/README.md)**. Lo esencial:

- Corre en el **anfitrión** con `docker exec`, no en un contenedor: la red `interna` no tiene salida a internet y darle una crearía la ruta de exfiltración que ese aislamiento evita.
- Se cifra con clave **pública**: el servidor crea respaldos y **no puede leerlos**. La privada no vive aquí. Perderla los hace irrecuperables.
- `pnpm backup:verify` recorre el ciclo entero (volcar → cifrar → descifrar → restaurar → comparar) y comprueba además que un respaldo **truncado falle**.
- `pnpm backup:status` avisa cuando el respaldo dejó de ocurrir — el fallo que de otro modo es indistinguible de que todo va bien.

⛔ **Sigue bloqueando el go-live del 30 oct**: falta configurar el destino remoto —**Google Drive vía rclone**, ya que R2 quedó descartado por exigir tarjeta— y, sobre todo, **ejecutar una restauración real en el VPS**. Un respaldo que nunca se restauró no es un respaldo.
