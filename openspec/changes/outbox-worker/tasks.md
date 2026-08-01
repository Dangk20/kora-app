# Tareas — consumidor de la bandeja de salida

> Bloques de 2 horas o menos, verificables por sí solos.
> Evidencia obligatoria por tarea: prueba en verde, salida de comando o verificación contra el entorno real. Nada se marca hecho "porque debería funcionar".

## 1. Esquema y contrato

- [x] 1.1 Añadir a `domain_events` el campo con la **fecha del próximo intento** (con valor por defecto, para que los eventos ya acumulados queden elegibles) y el índice que soporta la consulta de toma. Migración versionada.
- [x] 1.2 Definir en `src/modules/events/types.ts` el contrato del manejador: qué recibe, qué devuelve y qué significa que lance. Documentar en el propio tipo que **todo manejador debe ser idempotente** y por qué.
- [x] 1.3 Escribir el registro de manejadores por tipo de evento (`registry.ts`), admitiendo varios por tipo.

## 2. Motor de consumo

- [x] 2.1 Implementar la **toma exclusiva**: `SELECT ... FOR UPDATE SKIP LOCKED` en SQL directo (Prisma no lo expone), marcando los eventos como en proceso en la misma transacción, con límite de eventos por ciclo.
- [x] 2.2 Implementar la **ejecución**: buscar los manejadores del tipo, ejecutarlos, y marcar el evento como procesado solo si todos tuvieron éxito.
- [x] 2.3 Implementar el **fallo**: devolver a pendiente con el contador aumentado, el motivo registrado y la próxima fecha calculada con espera creciente; al agotar los intentos, dejarlo **muerto** de forma terminal.
- [x] 2.4 Implementar la **recuperación de huérfanos**: un evento en proceso más allá del umbral vuelve a pendiente.
- [x] 2.5 Manejar el **evento sin manejador registrado**: ni se marca procesado ni se reintenta en bucle; queda visible en el diagnóstico.

## 3. Pruebas de las invariantes

> Ninguna de estas es opcional: el primer consumidor real de esta cola acredita dinero.

- [x] 3.1 **Concurrencia:** dos consumidores simultáneos sobre la misma bandeja → ningún evento tomado por ambos y todos procesados exactamente una vez. Es el equivalente aquí del test de las 50 compras concurrentes del inventario.
- [x] 3.2 **Idempotencia:** entregar dos veces el mismo evento al mismo manejador → estado final idéntico al de una sola entrega.
- [x] 3.3 **Fallo tras aplicar el efecto:** simular la muerte del proceso entre aplicar el efecto y marcar el evento → el reintento no duplica el efecto.
- [x] 3.4 **Reintentos:** un manejador que falla incrementa el contador, registra el motivo y **no** se vuelve a tomar antes de su próxima fecha.
- [x] 3.5 **Muerte:** agotados los intentos, el evento queda terminal con el motivo del último fallo y ya no se toma.
- [x] 3.6 **Huérfanos:** un evento en proceso más allá del umbral vuelve a estar disponible.
- [x] 3.7 **Reglas del dominio:** un manejador no puede tocar `stockActual` fuera del motor de inventario ni provocar una transición que `canTransition()` rechace.

## 4. Observabilidad

- [x] 4.1 Escribir `health.ts`: conteos por estado y **antigüedad del pendiente más viejo**, que es el dato que distingue "hay carga" de "está atascado".
- [x] 4.2 Añadir el comando `pnpm outbox:status` con salida legible, en la línea de `pnpm ledger:verify`.
- [x] 4.3 Añadir el comando para **reintentar un evento muerto**: vuelve a pendiente con el contador reiniciado. Deliberadamente manual — los eventos muertos no reviven solos.
- [x] 4.4 Registros del worker: arranque con su intervalo, resultado por evento (identificador, tipo, resultado) y parada. **Sin datos personales del comprador ni secretos** — verificarlo leyendo la salida real.

## 5. El proceso

- [x] 5.1 Escribir `scripts/outbox-worker.ts`: bucle de sondeo con intervalo configurable y **parada ordenada** (deja de tomar eventos, termina el que tiene entre manos, sale).
- [x] 5.2 Añadir el comando `pnpm outbox:worker` y verificar la parada ordenada enviándole la señal de término mientras procesa.
- [x] 5.3 Escribir un **manejador de ejemplo** idempotente y verificable de punta a punta, que deje rastro comprobable. Es la demostración del contrato antes de que llegue el de cashback.

## 6. Verificación de punta a punta

- [x] 6.1 En local: confirmar un pedido desde el panel → comprobar que el evento pasa de pendiente a procesado y que el manejador de ejemplo dejó su rastro.
- [x] 6.2 Confirmar el **mismo** pedido dos veces (el botón es idempotente) → un solo evento, un solo efecto.
- [x] 6.3 Arrancar el worker contra el entorno de pruebas y observar cómo **drena los eventos ya acumulados** desde que existe el panel de pedidos. Registrar cuántos había.
- [x] 6.4 Detener el worker, confirmar un pedido, comprobar que el evento se acumula, volver a arrancarlo y comprobar que lo procesa. Es el escenario de reversión del diseño.

## 7. Despliegue y cierre

- [x] 7.1 Añadir el worker como servicio a `deploy/docker-compose.staging.yml` y `deploy/docker-compose.prod.yml`, reutilizando la imagen de la aplicación con otro punto de entrada, con su límite de memoria.
- [x] 7.2 Actualizar el presupuesto de memoria de `deploy/README.md` y confirmar que la suma sigue dejando margen para el sistema operativo.
- [ ] 7.3 Desplegar por el camino automático y verificar en el servidor que el worker está arriba y drenando.
- [x] 7.4 Registrar en `../notas-tecnicas-privado.md` las deudas asumidas: un manejador roto arrastra al evento entero, sin garantía de orden entre eventos, y los disparadores escritos para reconsiderar ambas.
- [x] 7.5 Actualizar `../bitacora-sprints-kora.md`: cierra el pendiente técnico #1 y queda desbloqueado el camino a S10–S13.
- [x] 7.6 Correr `pnpm typecheck && pnpm lint && pnpm build && pnpm test` y dejarlos en verde.


---

## Evidencia

**Pruebas:** 20 nuevas en `tests/outbox.test.ts` · **105 en total** (eran 85). Cubren concurrencia (dos trabajadores sobre 30 eventos, ninguno tomado dos veces), idempotencia, fallo tras aplicar el efecto, reintentos con espera, muerte terminal, huérfanos y diagnóstico.

**Verificado contra datos reales**, no solo en laboratorio:
- El worker **drenó los 2 eventos `order.confirmed` acumulados** desde que existe el panel de pedidos, dejando rastro en los pedidos 1 y 6.
- Devueltos a `PENDING` para simular un reintento tras caída, los reprocesó y **los rastros siguieron en 2** — idempotencia demostrada sobre datos reales.
- `SIGTERM` → terminó el evento en curso → salió con código 0, tanto en local como desde la imagen del contenedor.

**Verificación completa:** typecheck limpio · lint sin advertencias · 105/105 pruebas · build correcto.

## Bugs encontrados en la implementación

1. **Las pruebas ensuciaban datos reales.** `claimBatch` no filtra por tipo —no debe hacerlo— así que en una base de desarrollo con eventos reales los tomaba, los procesaba con manejadores de prueba y los dejaba en `PROCESSING`. En CI la base es efímera y daría igual; en la máquina de alguien, no. Corregido: las pruebas apartan los eventos reales mientras corren y los devuelven a su sitio al terminar.
2. **El worker apuntaba a la imagen equivocada.** `runner` es la salida *standalone* de Next: solo lleva `server.js` y un `node_modules` podado, **sin `tsx`, sin `scripts/` y sin `src/`**. No habría arrancado. Corregido con un objetivo `worker` propio en el mismo `Dockerfile`, verificado construyendo la imagen y arrancándola.
3. **Una prueba dependía de que la bandeja estuviera vacía**, y fallaba por el entorno y no por el código. Reformulada para medir diferencias en vez de valores absolutos.

## Incidente de entorno (no del código)

A mitad de la implementación el **disco del equipo de desarrollo se llenó al 99 %** (198 MB libres). PostgreSQL local empezó a devolver errores de E/S y la VM de Docker corrompió su metadata. Se liberaron ~5 GB de cachés regenerables y se reinició la VM; todo recuperado sin pérdida de datos. Queda como aviso: el disco de esa máquina estaba al límite y volverá a estarlo.
