## Context

Ver `proposal.md` — Why. Lo que condiciona el diseño es la topología ya desplegada (`deploy/docker-compose.prod.yml`):

- La base vive **solo** en la red `interna`, declarada `internal: true`: **sin salida a internet**, y sin publicar puertos al anfitrión. Es una propiedad demostrada con evidencia durante `vps-two-stack-deploy`, no una convención.
- El anfitrión sí tiene internet y tiene el socket de Docker.
- Ya existe un programador de trabajos propio (`src/modules/jobs/`) con cerrojo en base, reintentos y diagnóstico (`pnpm jobs:status`), que corre dentro del worker.
- El VPS es Ubuntu 24.04 endurecido: sin root, solo llave pública, `ufw`, `fail2ban`.

## Goals / Non-Goals

**Goals**

- Que el peor caso —perder el VPS entero— sea recuperable.
- Que comprometer el VPS **no** entregue además el histórico de datos personales de todos los clientes.
- Que dejar de respaldar sea **detectable**, no silencioso.
- Que la restauración esté probada, no supuesta.

**Non-Goals**

- Alta disponibilidad, réplicas, failover. El negocio tolera horas de caída; no tolera perder los datos.
- PITR / WAL archiving. Ver `proposal.md` — Fuera de alcance.
- Respaldar desde la aplicación. Ver decisión 2.

## Decisions

### 1. El respaldo corre en el ANFITRIÓN, con `docker exec`, no en un contenedor de la red interna

```
cron (anfitrión) → docker exec kora-prod-postgres pg_dump → age (cifra) → rclone (sube a R2)
```

**Por qué no un contenedor de respaldo en `interna`:** no podría subir nada — esa red no tiene salida. La única forma de que subiera sería darle también una red con internet, y eso significa un contenedor con acceso completo a la base **y** salida a internet: exactamente la ruta de exfiltración que el aislamiento existe para no tener. Se pagaría una propiedad de seguridad real por una comodidad de despliegue.

**`docker exec` no necesita red.** Entra por el socket de Docker, así que el volcado sale sin abrir un solo puerto ni tocar la topología. La base sigue tan incomunicada como antes.

**Coste asumido:** el respaldo deja de ser autocontenido en el `compose` y pasa a depender de dos binarios instalados en el anfitrión (`age`, `rclone`) y de una entrada de `cron`. Eso lo hace parte de la reconstrucción del servidor, y por eso queda escrito en `deploy/backup/README.md` junto al resto.

### 2. No lo hace el programador de trabajos de la aplicación, aunque ya existe

Sería lo natural: `JOBS` ya tiene cerrojo, reintentos y diagnóstico. Se descarta por una razón que pesa más que la elegancia: **el respaldo tiene que seguir funcionando cuando la aplicación no funciona.**

Un despliegue roto, una migración fallida, un `OOM` del worker o una imagen que no arranca son exactamente los momentos en que más falta hace un respaldo — y son los momentos en que el programador está caído. Un sistema de copias que comparte destino con lo que debe proteger no es una copia.

Lo que sí se integra es la **observación**: `pnpm backup:status` lee el estado del último respaldo, para que aparezca junto al resto del diagnóstico.

### 3. Cifrado asimétrico con `age`, y la clave privada NO vive en el servidor

`age` con un destinatario (`age -r <clave pública>`). El VPS lleva solo la pública.

**Frente a `gpg`:** `age` no tiene anillo de claves, ni servidores de claves, ni caducidades, ni modos de compatibilidad. Un binario y una línea. En un procedimiento que alguien va a seguir bajo presión, a las 3 de la mañana y quizá sin haberlo escrito, esa diferencia es lo único que importa.

**Frente a `openssl enc` con contraseña:** una contraseña simétrica tiene que estar en el servidor para cifrar. Quien entra al servidor la encuentra y descifra todo el histórico. El cifrado dejaría de proteger justo del escenario para el que existe.

**La contrapartida es real y se asume:** perder la clave privada hace los respaldos irrecuperables. No hay recuperación, no hay soporte, no hay reseteo. Por eso el procedimiento exige custodia en **dos** lugares, y por eso la verificación del ciclo completo se ejecuta de verdad — para que se descubra que la clave no funciona *antes* de necesitarla.

### 4. `pg_dump` en formato personalizado, no SQL plano

`pg_dump -Fc` comprime, permite restaurar en paralelo y —lo que importa— **`pg_restore` detecta un archivo truncado**. Un `.sql` plano truncado se restaura "correctamente" hasta donde llega y deja una base a medias sin que nada falle. Es la forma más silenciosa de perder datos durante una recuperación.

`pg_dump` toma una instantánea consistente sin bloquear escrituras (MVCC), así que la tienda sigue vendiendo mientras corre.

### 5. Se sube al destino con nombre nuevo, y solo entonces se rota

Orden: volcar → cifrar → subir → **verificar que el objeto existe en el destino** → borrar lo anterior a 30 días.

Borrar antes de confirmar dejaría al negocio, aunque sea unos segundos, con un respaldo menos y ninguno nuevo. Es un caso improbable y de consecuencia total, que además solo se manifiesta cuando ya ha fallado algo.

El destino previsto es Cloudflare R2 vía `rclone` (S3-compatible). **Es la misma cuenta que bloquea el despliegue de producción**: una decisión, dos bloqueos.

### 6. La verificación del ciclo es un comando, no un ritual

`pnpm backup:verify` recorre volcar → cifrar → descifrar → restaurar en una base desechable → comparar conteos por tabla contra el origen → **borrar la base desechable**, incluso si falla.

Se ejecuta contra la base **local**, no contra producción: es donde puede correr en cada sesión de trabajo y en el CI sin riesgo. Lo que verifica no son los datos de producción sino **el camino**: que el volcado se genera, que el cifrado y el descifrado son reversibles con las claves que hay, y que `pg_restore` reconstruye el esquema completo.

La restauración real desde el respaldo real de producción es un paso del procedimiento y tiene su propia fecha de última ejecución en `deploy/backup/README.md`.

### 7. No hay migración Prisma ni eventos de dominio

Este change no toca el esquema, ni el stock, ni precios, ni permisos, ni estados de pedido. No emite ni consume `domain_events`.

## Riesgos / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Perder la clave privada = perder los respaldos.** Es la contrapartida directa de la decisión 3 | Custodia obligatoria en dos lugares (gestor de Daniel + un segundo), documentada en el procedimiento. `pnpm backup:verify` ejercita el descifrado, así que una clave rota se descubre en desarrollo y no durante una recuperación |
| **El respaldo depende de binarios del anfitrión**, fuera del `compose`. Reconstruir el servidor sin instalarlos deja el sistema sin copias, en silencio | Van en la reconstrucción desde cero de `deploy/README.md`, y `pnpm backup:status` señala la ausencia de respaldos recientes: el fallo se vuelve visible en vez de silencioso |
| **Se pierde hasta un día de pedidos** en el peor caso | Declarado explícitamente en el procedimiento en vez de disimulado. Los pedidos del día se pueden reconstruir desde WhatsApp, que es donde ocurre el cobro. La alternativa (PITR) no cabe hoy |
| **El destino todavía no existe**: R2 sigue pendiente | Se construye completo con el envío detrás de configuración, igual que el correo y las imágenes. Activarlo es configuración, no desarrollo. El ciclo volcar/cifrar/descifrar/restaurar se verifica hoy sin R2 |
| **La instalación en el VPS toca infraestructura de producción** | Este change deja los guiones y el procedimiento listos y probados en local; **la instalación en el VPS la ejecuta Daniel**, igual que los despliegues |

## Migration Plan

1. Se construyen y verifican los guiones en local (`pnpm backup:verify`).
2. Cuando exista R2: crear el par de claves de `age`, guardar la privada fuera del servidor, poner la pública y las credenciales del destino en `.env.production`.
3. Instalar `age` y `rclone` en el VPS e instalar la entrada de `cron`.
4. **Ejecutar una restauración real** desde el respaldo real a una base desechable del VPS, y anotar la fecha en `deploy/backup/README.md`. Hasta ese paso, el DoD de S16 no está cumplido.

Rollback: quitar la entrada de `cron`. Nada de esto escribe en la base de producción.

## Open Questions

- **Hora del respaldo.** Se propone las 03:30 Colombia, después del despliegue nocturno de las 02:00 y lejos del tráfico. No cambia el diseño.
- **Un segundo destino** (otro proveedor) para no depender de una sola cuenta. Es lo correcto, y se puede añadir después sin tocar nada: es una línea más de envío.
