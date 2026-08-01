# Trabajos programados

**Semana del plan:** cierra pendientes de **S4** (job de verificación del libro contable, parte de su DoD) y **S8** (expiración de pedidos, PED_HU003). No es una semana nueva: es cobrar trabajo ya construido que nunca se puso a correr.

**HUs asociadas:** **PED_HU003** (expiración de pedidos pendientes a las 2 h) es la única. La verificación del libro contable y el diagnóstico de la bandeja de salida son **operación**, no comportamiento de producto: no tienen HU y no se inventa ninguna.

## Why

El proyecto tiene tres trabajos escritos, probados y funcionando **a mano**. Ninguno corre por sí solo.

**El más urgente es la expiración de pedidos.** La tienda ya genera pedidos reales, y `createOrder()` los crea aunque el comprador nunca envíe el mensaje de WhatsApp — es lo que pide la HU. Sin expiración automática, el panel se llena de pedidos "Pendiente" que nadie mandó y **que se quedan ahí para siempre**. Está anotado como deuda con esas palabras: *"es lo primero que hay que hacer antes de que el cliente vea el panel"*. El cliente va a ver el panel pronto.

**La verificación del libro contable es la que más duele si falta.** Comprueba que la suma de movimientos cuadra con la columna materializada `stockActual`. El inventario unificado entre web y POS es **el diferenciador del producto**, y una divergencia silenciosa entre el libro y el saldo materializado es el peor fallo que puede tener el sistema: la tienda vendería algo que no existe. El plan la describe como "job de verificación nocturno activo" desde el DoD de la Semana 4. Hoy solo corre cuando alguien se acuerda.

**El diagnóstico de la bandeja de salida** acaba de construirse con el worker. Sin ejecutarlo periódicamente, una cola atascada o un evento muerto se descubren por el cliente.

Los tres comparten el mismo modo de fallo, y es el que hace que esto merezca un change propio en vez de una línea de `crontab`: **un trabajo programado no falla ruidosamente, deja de correr en silencio.** Nadie nota que algo dejó de ejecutarse; se nota el daño, semanas después. Por eso lo importante aquí no es *ejecutar*, sino **poder responder "¿cuándo fue la última vez que esto corrió bien?"**.

## What Changes

- **Un programador que ejecuta los tres trabajos** en sus frecuencias, dentro de los dos entornos.
- **Sin solapamiento.** Una ejecución que tarde más que su intervalo no permite que la siguiente arranque encima. La expiración mueve estados de pedidos: dos ejecuciones simultáneas sobre el mismo pedido son un problema real, no teórico.
- **Registro de ejecuciones persistente:** cuándo corrió cada trabajo, cuánto tardó, qué hizo y si terminó bien.
- **Diagnóstico de los trabajos**, capaz de responder cuál lleva demasiado tiempo sin correr con éxito — que es la pregunta que detecta el fallo silencioso.
- **Frecuencias justificadas:** expiración cada 5 minutos, verificación del libro contable de madrugada, diagnóstico de la bandeja con la cadencia que haga útil el aviso sin generar ruido.

## Capabilities

### New Capabilities

- `job-scheduling`: ejecutar los trabajos periódicos en su cadencia, sin solapamiento y sin que un trabajo lento o roto arrastre a los demás.
- `job-observability`: poder responder cuándo corrió cada trabajo por última vez, qué hizo y si terminó bien — de forma que **dejar de correr** sea detectable, no solo fallar.

### Modified Capabilities

Ninguna. Los tres trabajos ya existen y **su lógica no cambia**: este change los pone a correr, no los reescribe.

## Fuera de alcance

- **Respaldo cifrado de la base a Cloudflare R2.** Es el trabajo programado más importante que faltará, pero tiene change propio (`encrypted-db-backup`), está bloqueado por la cuenta de almacenamiento y **bloquea el go-live**. Meterlo aquí lo escondería detrás de un change que sí puede cerrarse.
- **Alertas por correo o mensajería.** Hoy no hay canal: el número de WhatsApp comercial sigue sin confirmar por el cliente y el dominio no tiene registros de correo configurados (deuda #7 de la bitácora). Sin canal, una alerta es una función que no avisa a nadie.
- **Monitoreo externo** (Uptime Kuma, Sentry): el plan los reserva para S15.
- **Reescribir la lógica de los trabajos.** `expireStaleOrders()`, `ledger:verify` y `outboxHealth()` funcionan y están probados.

## Bloqueos declarados

**Ninguno.** No depende de ningún insumo pendiente del cliente.

## Impact

**Archivos nuevos**
- `src/modules/jobs/` — definición de los trabajos, programador y diagnóstico
- `scripts/jobs-status.ts` — consulta del estado de los trabajos
- `tests/jobs.test.ts` — no solapamiento, registro de ejecuciones, detección de "lleva demasiado sin correr"

**Archivos modificados**
- `prisma/schema.prisma` + migración — registro de ejecuciones
- `scripts/outbox-worker.ts` — según la decisión de diseño sobre dónde vive el programador
- `package.json`, los dos `docker-compose` de `deploy/` y `deploy/README.md`

**Reglas del proyecto que este change NO puede violar**
- La expiración de pedidos mueve estados y por tanto **pasa por `canTransition()`**. Jamás escribe el estado directamente.
- **`ledger:verify` es de solo lectura.** Si detecta divergencia, **avisa; no corrige**. Corregir automáticamente un libro contable descuadrado esconde exactamente el problema que hay que investigar.
- Ningún trabajo toca `stockActual` ni `onlineUnits` fuera del motor de inventario.

**Riesgo principal**
Ejecutar cosas solo, sin nadie mirando, sobre datos reales. La expiración **cancela pedidos**: si su criterio fuera incorrecto o corriera dos veces a la vez, cancelaría ventas legítimas. Por eso el no-solapamiento y el registro de ejecuciones no son adornos de este change, son su contenido.
