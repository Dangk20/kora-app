## 1. Elección explícita del destino

- [x] 1.1 En `src/modules/storage/config.ts`: leer `KORA_STORAGE_DRIVER` (`disk` | `r2`), obligatoria en producción y sin valor por defecto ahí; `disk` en desarrollo. Valor no reconocido = error nombrando los válidos.
- [x] 1.2 Exigir la configuración del driver **elegido**: con `r2`, todas sus credenciales; con `disk`, `KORA_UPLOADS_DIR` en producción.
- [x] 1.3 En `src/modules/storage/index.ts`: seleccionar por la variable, **eliminando el respaldo automático a disco** cuando falten variables de R2.
- [x] 1.4 Tests: producción sin variable → error; `r2` incompleto → error **y no cae a disco**; `disk` sin directorio → error; valor inválido → error; desarrollo sin nada → disco.

## 2. Directorio de subidas configurable

- [x] 2.1 `LocalStorageDriver` toma su directorio de `KORA_UPLOADS_DIR`, con `.uploads/` bajo el proyecto como valor de desarrollo. `resolveUploadPath` sigue rechazando cualquier clave que se salga.
- [x] 2.2 Tests de la resolución de rutas con directorio configurado: claves con `..`, absolutas y con byte nulo siguen rechazadas.

## 3. Comprobación de persistencia al arrancar

- [x] 3.1 `src/modules/storage/persistence.ts`: si la base registra imágenes y el directorio de subidas no tiene ninguna → error. Solo aplica en producción y con `disk`.
- [x] 3.2 Engancharla en `src/instrumentation.ts` con `process.exit(1)`, junto a las guardas ya existentes.
- [x] 3.3 Tests: base con imágenes + directorio vacío → falla; base vacía + directorio vacío → pasa; ambos con contenido → pasa; con `r2` → no comprueba nada.

## 4. Servir las imágenes en producción

- [x] 4.1 `src/app/media/[...key]/route.ts`: sustituir la condición de entorno por la del driver — sirve con `disk` en cualquier entorno, 404 con `r2`.
- [x] 4.2 Conservar el caché inmutable de un año, que es lo que hace que el CDN pregunte una sola vez.
- [x] 4.3 Tests de la ruta: sirve con `disk`; 404 con `r2`; clave con fuga de directorio → 400.

## 5. Volumen y despliegue

- [x] 5.1 Volumen de subidas en `deploy/docker-compose.prod.yml` y `.staging.yml`, montado en la ruta de `KORA_UPLOADS_DIR`.
- [x] 5.2 Variables nuevas en `.env.example` y en `deploy/README.md`, con la advertencia de que **sin el volumen cada despliegue borra las fotos** y que por eso el arranque lo comprueba.
- [x] 5.3 Documentar en `deploy/README.md` el paso de DNS a Cloudflare con proxy, dejando claro que es gratuito y **no pide tarjeta**.

## 6. Las imágenes entran en el respaldo

- [x] 6.1 `deploy/backup/respaldar.sh`: empaquetar volcado + directorio de subidas en **un solo** archivo cifrado. Con destino `r2` no intentar incluir imágenes, y anotarlo.
- [x] 6.2 `deploy/backup/restaurar.sh`: restaurar ambos, con el directorio de imágenes también explícito.
- [x] 6.3 Actualizar `deploy/backup/README.md`: qué contiene ahora el respaldo y cómo se recuperan las imágenes.

## 7. Cierre

- [x] 7.1 Registrar en `../notas-tecnicas-privado.md`: por qué se revierte la decisión del plan técnico §3, qué deuda se acepta (imágenes atadas al VPS y al respaldo), y que volver a R2 es una variable.
- [x] 7.2 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde, y actualizar `../bitacora-sprints-kora.md`.
