## Context

Ver `proposal.md` — Why. Lo que condiciona el diseño:

- `src/modules/storage/` ya tiene la abstracción de dos drivers y la usa todo el sistema; nadie fuera del módulo sabe dónde viven los bytes. **Esta es la pieza que hace barato el cambio**, y estaba escrita desde S3 exactamente para esto.
- `storage()` hoy decide así: *"si están todas las variables de R2, R2; si no, disco"*, con `assertStorageConfigured()` exigiendo R2 en producción. Es decir, en producción **siempre** R2.
- `LocalStorageDriver` escribe en `.uploads/` bajo `process.cwd()`, fijo.
- `/media/[...key]` ya valida la clave contra fugas de directorio y ya pone caché inmutable — pero devuelve 404 en producción.
- El respaldo cifrado (`deploy/backup/`) existe desde hoy y todavía no está instalado en el VPS.

## Goals / Non-Goals

**Goals**

- Desbloquear producción sin tarjeta y sin romper la posibilidad de volver a R2 mañana.
- Que sea **imposible** perder las fotos por un despliegue sin que nada falle.
- Que el ancho de banda de las imágenes lo pague el CDN, no el VPS.

**Non-Goals**

- Sustituir la abstracción de almacenamiento por acceso directo a disco. Se conserva íntegra: es lo que permite volver a R2 cambiando una variable.
- Optimización de imágenes (redimensionar, convertir a WebP). Ver `proposal.md`.

## Decisions

### 1. El driver se elige EN VOZ ALTA, y no hay respaldo automático

`KORA_STORAGE_DRIVER` ∈ `{ disk, r2 }`. En producción es obligatoria; en desarrollo, ausente significa `disk`.

**Se elimina el comportamiento actual de "si falta configuración de R2, usa disco".** Parece una comodidad y en producción es una trampa: un error de tecleo en `R2_SECRET_ACCESS_KEY` no produciría ningún error. La aplicación arrancaría, el operador subiría fotos, se guardarían en la capa efímera del contenedor, y el siguiente despliegue las borraría. Nada en ninguna pantalla lo diría.

Es el mismo criterio que ya se aplicó tres veces en este proyecto —R2, correo, datos del comerciante—: **la configuración incompleta tumba el arranque en vez de degradarse en silencio.** Aquí se extiende a "configuración ambigua".

### 2. La comprobación de persistencia: lo que de verdad protege el trabajo del cliente

Al arrancar en producción con `disk`:

```
si (la base registra imágenes de producto) y (el directorio de subidas está vacío):
    explicar y terminar con código ≠ 0
```

**Por qué esta comprobación y no otra.** El fallo previsible de esta arquitectura es olvidar el volumen en el `compose`. Sin volumen, `.uploads` vive dentro del contenedor: se crea sin error, se escribe sin error, y desaparece en cada `up -d --force-recreate`. La tienda responde 200, el catálogo está completo, y **todas las fichas salen sin foto**. Es exactamente el defecto que ya se corrigió una vez en este proyecto —el contenedor que pasaba la verificación de salud con la tienda rota— reapareciendo por otra puerta.

Comparar contra la base es lo que lo hace detectable: "hay 340 imágenes registradas y 0 archivos" no admite otra lectura.

**Falsos positivos considerados:** una instalación nueva tiene la base sin imágenes y el directorio vacío → arranca. Una restauración a medias (base restaurada, imágenes todavía no) sí detiene el arranque, y **es lo correcto**: esa tienda no debe abrirse al público.

**Coste:** una consulta `count` al arrancar. Se acepta.

### 3. El directorio de subidas se configura, no se deduce

`KORA_UPLOADS_DIR`, obligatorio en producción con `disk`. En desarrollo sigue siendo `.uploads/` bajo el directorio del proyecto.

Dejar la ruta fija a `process.cwd()/.uploads` obligaría a montar el volumen justo ahí dentro de la imagen *standalone* de Next, que es un detalle interno del empaquetado. Una ruta explícita (`/data/uploads`) hace el montaje evidente en el `compose` y no depende de dónde arranque el proceso.

### 4. `/media` sirve en producción, pero solo con `disk`

Se sustituye `if (NODE_ENV === "production") return 404` por `if (driver !== "disk") return 404`.

La condición correcta nunca fue el entorno sino **dónde viven los archivos**. Con `r2` la ruta sigue muerta en cualquier entorno, que es la garantía original —"el VPS jamás sirve imágenes"— expresada sobre la variable que de verdad la decide.

El caché inmutable de un año ya está escrito y es lo que hace que el CDN pregunte una sola vez por imagen. Sin él, poner el CDN delante no ahorraría nada.

### 5. El respaldo empaqueta base + imágenes en UN archivo cifrado

`tar` del volcado y del directorio de subidas → una tubería → `age` → destino.

**Un archivo y no dos:** dos archivos pueden desincronizarse —la base de hoy con las imágenes de ayer— y obligan a acertar la pareja durante una recuperación, con prisa. Uno solo hace imposible restaurar mitades que no se corresponden.

Crece el tamaño (de ~85 KiB a algunos GB), pero el egreso de Cloudflare es gratuito y la retención de 30 días sobre ~1,2 GB sigue dentro de cualquier cupo razonable.

### 6. El CDN va delante, y es tarea de configuración, no de código

DNS de `korashopp.com` a Cloudflare con proxy activado. La aplicación no cambia: emite caché inmutable y el CDN hace el resto. **No requiere tarjeta** — el plan gratuito de DNS/CDN es distinto de R2.

Sin el CDN el sistema funciona igual, solo que el VPS sirve cada imagen cada vez. Es una degradación de rendimiento, no de corrección: se puede desplegar hoy y activar el CDN después.

### 7. Sin migración Prisma ni eventos de dominio

No cambia el esquema. Las claves de imagen guardadas en la base **no cambian de formato**: son las mismas rutas lógicas, y `urlFor()` las resuelve según el driver. Volver a R2 mañana no exige reescribir ninguna fila.

## Riesgos / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Un despliegue sin volumen borra todas las fotos** | Decisión 2: el arranque se detiene. Es el riesgo principal y tiene la defensa principal |
| **Las imágenes dependen del disco del VPS y del respaldo.** Un servicio replicado era más robusto | Aceptado y declarado en el proposal. Las imágenes entran en el respaldo cifrado (decisión 5). El día que haya tarjeta, volver a R2 es cambiar una variable |
| **El respaldo pasa de KiB a GB.** Podría tardar más que la ventana nocturna o llenar el cupo | Egreso gratuito y ~1,2 GB × 30 días está lejos de cualquier límite. Si algún día aprieta, separar imágenes en un respaldo semanal es un cambio pequeño |
| **Sin CDN el VPS sirve cada imagen cada vez** | Funciona igual, solo más lento. El CDN se activa después sin tocar código |
| **`/media` pasa a ser ruta pública en producción**: es superficie nueva | La validación de clave contra fugas de directorio ya existía y está probada; se le añade prueba explícita en producción |

## Migration Plan

1. Se despliega con `KORA_STORAGE_DRIVER=disk` y el volumen montado. En una base sin imágenes, la comprobación de persistencia no impide nada.
2. El cliente sube el catálogo con fotos.
3. Se instala el respaldo (change `encrypted-db-backup`) y se ejecuta una restauración real: ahí se comprueba que las imágenes vuelven.
4. Se mueve el DNS a Cloudflare y se activa el proxy.

Rollback: `KORA_STORAGE_DRIVER=r2` con credenciales, si algún día existen. Las claves guardadas en la base no cambian, así que el cambio es simétrico — salvo por copiar los archivos, que no es un rollback de código.

## Open Questions

- **Ruta del volumen en el anfitrión.** Se propone `/home/deploy/kora/uploads`, junto al resto. No cambia el diseño.
