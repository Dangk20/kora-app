## 1. Guion de respaldo

- [x] 1.1 `deploy/backup/respaldar.sh`: comprueba **antes de volcar** que hay clave pública y destino configurados; `docker exec` + `pg_dump -Fc`; cifra con `age -r`; sube con `rclone`; confirma que el objeto existe en el destino; y solo entonces rota lo anterior a 30 días.
- [x] 1.2 Limpieza garantizada de temporales con `trap` en `EXIT` y en señales, para que un fallo o una interrupción no dejen el volcado sin cifrar en el disco.
- [x] 1.3 Temporales en un directorio propio con permisos `700` y nombre irrepetible, nunca en `/tmp` compartido.
- [x] 1.4 `set -euo pipefail` y comprobación explícita del estado de **cada** etapa de la tubería: una tubería que falla en medio devuelve éxito por omisión, y eso subiría un archivo truncado como si fuera un respaldo bueno.

## 2. Restauración

- [x] 2.1 `deploy/backup/restaurar.sh`: exige base de destino explícita (sin valor por defecto), descifra con la clave privada y restaura con `pg_restore`.
- [x] 2.2 Confirmación adicional si la base de destino ya contiene datos.
- [x] 2.3 Verificar a mano que sin argumentos se detiene y explica qué falta, sin tocar ninguna base.

## 3. Verificación del ciclo completo

- [x] 3.1 `scripts/verify-backup.ts` + `pnpm backup:verify`: volcar la base local → cifrar → descifrar → restaurar en una base desechable → comparar conteos por tabla contra el origen → borrar la desechable **también si falla**.
- [x] 3.2 Generar un par de claves de prueba para el ciclo, en un directorio ignorado por git, sin exigir claves reales para correr la verificación.
- [x] 3.3 Caso negativo: un respaldo truncado o alterado debe hacer fallar la verificación, y no dejar la base de prueba a medio restaurar.
- [x] 3.4 Comprobar que la base de origen queda intacta tras la verificación.

## 4. Detección de que el respaldo dejó de ocurrir

- [x] 4.1 `scripts/backup-status.ts` + `pnpm backup:status`: fecha y tamaño del último respaldo correcto; fallo si supera 48 h; y distinguir explícitamente "nunca ha corrido" de "está atrasado".
- [x] 4.2 El guion de respaldo deja constancia de cada ejecución (éxito y fallo) donde `backup:status` la pueda leer.
- [x] 4.3 Tests de la lectura de estado: al día, atrasado, y nunca ejecutado.

## 5. Configuración y procedimiento

- [x] 5.1 Variables del respaldo en `.env.example` y en `deploy/README.md` §Respaldos, sustituyendo el "⛔ No existen todavía".
- [x] 5.2 `deploy/backup/README.md`: generación y custodia del par de claves, entrada de `cron` propuesta (03:30 Colombia), procedimiento de recuperación ante desastre paso a paso, **límite de pérdida declarado** (hasta un día) y un campo con la fecha de la última restauración real ejecutada.
- [x] 5.3 Añadir `age` y `rclone` a la reconstrucción desde cero del servidor en `deploy/README.md`.

## 6. Cierre

- [x] 6.1 Registrar en `../notas-tecnicas-privado.md`: que la clave privada es un punto único de pérdida asumido, que el respaldo depende de binarios fuera del `compose`, y que el DoD de S16 **no** está cumplido hasta ejecutar una restauración real en el VPS.
- [x] 6.2 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde, y actualizar `../bitacora-sprints-kora.md`.
