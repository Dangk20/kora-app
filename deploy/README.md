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

**2. Docker** desde el repositorio oficial (no el paquete de Ubuntu).

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

Automático desde GitHub Actions. `main` despliega a **pruebas** sin intervención; **producción** exige aprobación humana (`environment: production`).

```
verificación → imagen → pruebas (automático) → producción (aprobación)
```

Secretos del repositorio: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`. La credencial del registro es **efímera**, del propio flujo: no queda ninguna permanente en el servidor.

> ⚠️ **`environment: production` por sí solo NO exige aprobación.** Sin reglas de protección, GitHub ejecuta el trabajo directo aunque el YAML declare el entorno. La aprobación humana la impone marcar **`Required reviewers`** en `Settings → Environments → production`. Sin ese checkbox el requisito de la spec no se cumple, y nada en el repositorio lo delata.

**Revertir:** volver a levantar la etiqueta anterior. El historial está en `~/kora/deploy/historial-despliegues.tsv`.

```bash
cd ~/kora/deploy
sed -i 's|^KORA_IMAGE=.*|KORA_IMAGE=ghcr.io/dangk20/kora-app/app:<etiqueta>|' .env.staging
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --no-deps --force-recreate app
```

Las migraciones **no** se revierten solas: se asume compatibilidad hacia atrás del esquema. Una migración destructiva exige plan propio.

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

## Certificados

Los emite y renueva Caddy solo. Persisten en el volumen `kora-edge_caddy_data`: **no borrarlo** o se vuelven a solicitar en cada recreación y se agota la cuota del emisor (5 por dominio a la semana).

Mientras se ajusta el enrutamiento, apuntar `KORA_ACME_CA` a la autoridad de **pruebas** — emite certificados que el navegador no reconoce, pero sin cuota práctica.

## Respaldos

⛔ **No existen todavía.** Se descartaron los snapshots del proveedor por presupuesto, así que el `pg_dump` diario cifrado a Cloudflare R2 con retención de 30 días **es la única capa de respaldo del proyecto**. Es un change aparte (`encrypted-db-backup`) y **bloquea el go-live del 30 oct**: un respaldo que nunca se restauró no es un respaldo.
