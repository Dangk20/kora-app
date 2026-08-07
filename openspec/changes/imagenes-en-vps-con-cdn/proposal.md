# Imágenes de producto servidas desde el VPS, detrás del CDN gratuito

**Semana del plan:** ninguna en concreto. Desbloquea **S16 (Producción)** y con ella el go-live: hoy producción no puede arrancar.

**HU de referencia:** **ninguna**. Es infraestructura. El plan técnico §3 fijaba el almacenamiento remoto; esto lo revisa.

**Alcance:** dentro de lo cotizado — es la misma capacidad (servir fotos de producto) por otro camino.

## Why

Producción **no arranca sin Cloudflare R2**, por diseño, y R2 exige registrar una tarjeta aunque su plan sea gratuito. Daniel decidió no poner tarjeta (7 ago). Ese requisito llevaba parado el despliegue desde el 1 de agosto y bloquea además el destino de los respaldos, así que no es un detalle de configuración: **es lo único que separa la tienda de poder vender.**

El VPS tiene 96 GB de disco y 1.000 productos con sus fotos ocupan ~1,2 GB. La capacidad nunca fue el problema. Los dos reparos que llevaron a elegir almacenamiento externo eran otros, y **los dos son resolubles hoy**:

- *"El VPS no debe gastar su ancho de banda sirviendo fotos"* → deja de ser cierto con el CDN de Cloudflare delante, cuyo plan gratuito **no pide tarjeta** (la pide R2, que es el producto de almacenamiento, no el CDN). El VPS entrega cada imagen una vez.
- *"Las imágenes quedarían fuera de cualquier respaldo"* → era el reparo serio, y era cierto cuando no había respaldos. Desde hoy sí los hay, y añadirles un directorio es barato.

Sin esos dos argumentos en pie, insistir en almacenamiento externo es mantener un bloqueo por fidelidad a una decisión cuyas premisas cambiaron.

## What Changes

- **El almacenamiento se elige explícitamente** con `KORA_STORAGE_DRIVER` (`disk` o `r2`). En producción **no hay valor por defecto y no hay respaldo automático**: sin elección explícita y completa, la aplicación no arranca.
  - Hoy el código cae a disco cuando faltan variables de R2. En producción eso significa que **un error de tecleo en una credencial de R2 no da error**: las fotos se guardarían en el disco efímero del contenedor y desaparecerían en el siguiente despliegue. Elegir en voz alta cierra esa puerta.
- **`/media` sirve en producción** cuando el driver es disco, con caché inmutable de un año para que el CDN no vuelva a preguntar. Con driver `r2` sigue respondiendo 404: si las imágenes están fuera, el VPS no sirve ninguna.
- **Las subidas viven en un volumen de Docker**, no en el sistema de archivos del contenedor.
- **⚠️ Comprobación de persistencia al arrancar** — la parte que de verdad importa. Si la base dice que hay imágenes de producto y el directorio de subidas está vacío, el proceso **no arranca**.
  - Es el modo de fallo que puede destruir el trabajo del cliente sin un solo error: olvidar el volumen en el `compose` hace que las fotos vivan en la capa efímera del contenedor, y **cada despliegue las borra todas**. La tienda seguiría respondiendo 200 con el catálogo entero sin fotos, y el catálogo lo cargó el cliente a mano.
- **Las imágenes entran en el respaldo cifrado** que se construyó hoy: mismo cifrado, mismo destino, misma retención.
- **El DNS pasa a Cloudflare** con el proxy activado, para que el CDN cachee. Es tarea de Daniel y no requiere tarjeta.

## Capabilities

### New Capabilities
- `image-persistence`: dónde viven las imágenes de producto, cómo se elige, y la garantía de que un despliegue no puede borrarlas en silencio.

### Modified Capabilities
Ninguna publicada. `deploy/backup` se amplía dentro del change `encrypted-db-backup`, que aún no está archivado.

## Impact

**Código tocado**
- `src/modules/storage/config.ts` — elección explícita de driver y sus comprobaciones.
- `src/modules/storage/index.ts` — selección sin respaldo automático.
- `src/modules/storage/local-driver.ts` — directorio configurable, no fijo a `.uploads`.
- `src/app/media/[...key]/route.ts` — sirve en producción con driver de disco.
- `src/instrumentation.ts` — comprobación de persistencia.
- `deploy/docker-compose.prod.yml` y `.staging.yml` — volumen de subidas.
- `deploy/backup/respaldar.sh` y `restaurar.sh` — incluir imágenes.

**Lo que hay que hacer fuera del código** (Daniel)
1. Mover el DNS de `korashopp.com` a Cloudflare y activar el proxy (naranja). Gratis, sin tarjeta.
2. Desplegar producción por primera vez.

**Fuera de alcance**
- Redimensionado o conversión automática de imágenes. Hoy se sirve lo que se sube; el importador ya valida tipo y tamaño máximo.
- Replicación de las imágenes a un segundo sitio. El respaldo cifrado cubre la pérdida; la alta disponibilidad no está en el alcance.

**Deuda que esto acepta a conciencia**
Las imágenes pasan a depender del disco del VPS y de que el respaldo se esté ejecutando. Es un paso más en la recuperación que tenerlas en un servicio replicado. **Se cambia una dependencia externa con tarjeta por una dependencia interna con respaldo**, y se dice en voz alta en vez de descubrirlo el día del desastre.
