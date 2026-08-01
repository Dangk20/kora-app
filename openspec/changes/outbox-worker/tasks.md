# Tareas — consumidor de la bandeja de salida

> Bloques de 2 horas o menos, verificables por sí solos.
> Evidencia obligatoria por tarea: prueba en verde, salida de comando o verificación contra el entorno real. Nada se marca hecho "porque debería funcionar".

## 1. Esquema y contrato

- [ ] 1.1 Añadir a `domain_events` el campo con la **fecha del próximo intento** (con valor por defecto, para que los eventos ya acumulados queden elegibles) y el índice que soporta la consulta de toma. Migración versionada.
- [ ] 1.2 Definir en `src/modules/events/types.ts` el contrato del manejador: qué recibe, qué devuelve y qué significa que lance. Documentar en el propio tipo que **todo manejador debe ser idempotente** y por qué.
- [ ] 1.3 Escribir el registro de manejadores por tipo de evento (`registry.ts`), admitiendo varios por tipo.

## 2. Motor de consumo

- [ ] 2.1 Implementar la **toma exclusiva**: `SELECT ... FOR UPDATE SKIP LOCKED` en SQL directo (Prisma no lo expone), marcando los eventos como en proceso en la misma transacción, con límite de eventos por ciclo.
- [ ] 2.2 Implementar la **ejecución**: buscar los manejadores del tipo, ejecutarlos, y marcar el evento como procesado solo si todos tuvieron éxito.
- [ ] 2.3 Implementar el **fallo**: devolver a pendiente con el contador aumentado, el motivo registrado y la próxima fecha calculada con espera creciente; al agotar los intentos, dejarlo **muerto** de forma terminal.
- [ ] 2.4 Implementar la **recuperación de huérfanos**: un evento en proceso más allá del umbral vuelve a pendiente.
- [ ] 2.5 Manejar el **evento sin manejador registrado**: ni se marca procesado ni se reintenta en bucle; queda visible en el diagnóstico.

## 3. Pruebas de las invariantes

> Ninguna de estas es opcional: el primer consumidor real de esta cola acredita dinero.

- [ ] 3.1 **Concurrencia:** dos consumidores simultáneos sobre la misma bandeja → ningún evento tomado por ambos y todos procesados exactamente una vez. Es el equivalente aquí del test de las 50 compras concurrentes del inventario.
- [ ] 3.2 **Idempotencia:** entregar dos veces el mismo evento al mismo manejador → estado final idéntico al de una sola entrega.
- [ ] 3.3 **Fallo tras aplicar el efecto:** simular la muerte del proceso entre aplicar el efecto y marcar el evento → el reintento no duplica el efecto.
- [ ] 3.4 **Reintentos:** un manejador que falla incrementa el contador, registra el motivo y **no** se vuelve a tomar antes de su próxima fecha.
- [ ] 3.5 **Muerte:** agotados los intentos, el evento queda terminal con el motivo del último fallo y ya no se toma.
- [ ] 3.6 **Huérfanos:** un evento en proceso más allá del umbral vuelve a estar disponible.
- [ ] 3.7 **Reglas del dominio:** un manejador no puede tocar `stockActual` fuera del motor de inventario ni provocar una transición que `canTransition()` rechace.

## 4. Observabilidad

- [ ] 4.1 Escribir `health.ts`: conteos por estado y **antigüedad del pendiente más viejo**, que es el dato que distingue "hay carga" de "está atascado".
- [ ] 4.2 Añadir el comando `pnpm outbox:status` con salida legible, en la línea de `pnpm ledger:verify`.
- [ ] 4.3 Añadir el comando para **reintentar un evento muerto**: vuelve a pendiente con el contador reiniciado. Deliberadamente manual — los eventos muertos no reviven solos.
- [ ] 4.4 Registros del worker: arranque con su intervalo, resultado por evento (identificador, tipo, resultado) y parada. **Sin datos personales del comprador ni secretos** — verificarlo leyendo la salida real.

## 5. El proceso

- [ ] 5.1 Escribir `scripts/outbox-worker.ts`: bucle de sondeo con intervalo configurable y **parada ordenada** (deja de tomar eventos, termina el que tiene entre manos, sale).
- [ ] 5.2 Añadir el comando `pnpm outbox:worker` y verificar la parada ordenada enviándole la señal de término mientras procesa.
- [ ] 5.3 Escribir un **manejador de ejemplo** idempotente y verificable de punta a punta, que deje rastro comprobable. Es la demostración del contrato antes de que llegue el de cashback.

## 6. Verificación de punta a punta

- [ ] 6.1 En local: confirmar un pedido desde el panel → comprobar que el evento pasa de pendiente a procesado y que el manejador de ejemplo dejó su rastro.
- [ ] 6.2 Confirmar el **mismo** pedido dos veces (el botón es idempotente) → un solo evento, un solo efecto.
- [ ] 6.3 Arrancar el worker contra el entorno de pruebas y observar cómo **drena los eventos ya acumulados** desde que existe el panel de pedidos. Registrar cuántos había.
- [ ] 6.4 Detener el worker, confirmar un pedido, comprobar que el evento se acumula, volver a arrancarlo y comprobar que lo procesa. Es el escenario de reversión del diseño.

## 7. Despliegue y cierre

- [ ] 7.1 Añadir el worker como servicio a `deploy/docker-compose.staging.yml` y `deploy/docker-compose.prod.yml`, reutilizando la imagen de la aplicación con otro punto de entrada, con su límite de memoria.
- [ ] 7.2 Actualizar el presupuesto de memoria de `deploy/README.md` y confirmar que la suma sigue dejando margen para el sistema operativo.
- [ ] 7.3 Desplegar por el camino automático y verificar en el servidor que el worker está arriba y drenando.
- [ ] 7.4 Registrar en `../notas-tecnicas-privado.md` las deudas asumidas: un manejador roto arrastra al evento entero, sin garantía de orden entre eventos, y los disparadores escritos para reconsiderar ambas.
- [ ] 7.5 Actualizar `../bitacora-sprints-kora.md`: cierra el pendiente técnico #1 y queda desbloqueado el camino a S10–S13.
- [ ] 7.6 Correr `pnpm typecheck && pnpm lint && pnpm build && pnpm test` y dejarlos en verde.
