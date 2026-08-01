# Diseño — trabajos programados

## Context

Motivación en `proposal.md` §Why. Requisitos en `specs/`.

**Lo que ya existe.** Tres trabajos escritos y probados, invocables por `package.json`, todos con la misma forma: leen, actúan, imprimen y ponen `process.exitCode = 1` si algo va mal.

| Trabajo | Función | Naturaleza |
|---|---|---|
| `orders:expire` | `expireStaleOrders()` | **Escribe** — cancela pedidos vencidos |
| `ledger:verify` | Suma movimientos vs. `stockActual` | **Solo lectura** |
| `outbox:status` | `outboxHealth()` | **Solo lectura** |

**Lo que acaba de existir.** El change `outbox-worker` dejó corriendo un proceso de larga duración por entorno, con bucle, intervalo configurable y parada ordenada. Ese proceso ya sabe hacer casi todo lo que un programador necesita.

**Restricción de operación.** Dos entornos sobre un VPS de 2 vCPU con 1.9 GB de margen tras sumar el worker. Cada contenedor nuevo cuesta memoria comprometida.

## Goals / Non-Goals

**Goals**

- Que los tres trabajos corran solos, y que **dejar de correr** sea detectable.
- Que la expiración no pueda cancelar pedidos dos veces a la vez.
- Añadir el mínimo de piezas nuevas: la máquina ya tiene siete contenedores.

**Non-Goals de diseño**

- **Expresiones cron completas.** Tres trabajos con cadencias fijas no justifican un intérprete de cron.
- **Reponer ejecuciones perdidas.** Si el programador estuvo caído dos horas, la expiración corre **una vez** y recoge todo lo vencido — no veinticuatro veces.
- **Alertar.** No hay canal (ver proposal §Fuera de alcance). Aquí se deja el dato listo para que alguien lo consulte o lo encadene.
- **Coordinación distribuida.** Un programador por entorno.

## Decisions

### 1. El programador vive dentro del worker de eventos

**Decisión:** el proceso `outbox-worker` pasa a llamarse **worker** a secas y hace dos cosas: consumir la bandeja de salida y disparar los trabajos programados. No se añade ningún contenedor.

**Por qué:** ya hay un proceso de larga duración por entorno, con bucle, parada ordenada, acceso a la base y su presupuesto de memoria asignado. Un segundo contenedor cuyo trabajo es **dormir** cuesta memoria comprometida en una máquina con 1.9 GB de margen, duplica la configuración de despliegue y añade otro proceso que puede caerse en silencio.

Los trabajos son cortos y poco frecuentes; la bandeja de salida es un sondeo ligero. No compiten por nada.

**Consecuencia aceptada:** si el worker se cae, se detienen **las dos cosas**. Está mitigado por el reinicio automático del contenedor y, sobre todo, porque ambas son observables: la bandeja por la antigüedad de su pendiente más viejo, y los trabajos por su última ejecución con éxito. Dos señales independientes apuntando al mismo proceso.

**Alternativa descartada — cron del sistema anfitrión:** obliga a que el anfitrión conozca los contenedores (`docker exec`), rompe la propiedad de que el servidor se reconstruye desde el repositorio (el cron viviría fuera), y su salida termina en el correo del sistema, que nadie lee.

**Alternativa descartada — contenedor programador propio:** más limpio conceptualmente, pero paga memoria y configuración a cambio de un aislamiento que no compra nada: ambos procesos hacen lo mismo, esperar y actuar.

### 2. Sin solapamiento: cerrojo en la base, no una bandera en memoria

**Decisión:** antes de ejecutar, el trabajo intenta tomar un **cerrojo consultivo de PostgreSQL** con su nombre. Si no lo consigue, la ejecución se omite y se registra como omitida.

**Por qué:** una bandera en memoria protege de un solo proceso contra sí mismo, pero no de **dos programadores a la vez** — que es exactamente lo que ocurre durante un despliegue solapado, cuando el contenedor viejo aún no murió y el nuevo ya arrancó. La expiración cancela pedidos: en ese momento preciso podrían competir por el mismo.

Un cerrojo consultivo es la herramienta correcta: no bloquea filas, se libera solo si el proceso muere, y su alcance es la sesión de base de datos.

**Alternativa descartada — una fila con `EN CURSO`:** hay que liberarla a mano, y un proceso que muere deja el trabajo bloqueado para siempre. Es reintroducir el problema de los eventos huérfanos que el worker ya tuvo que resolver.

### 3. El registro de ejecuciones es una tabla, no los registros del contenedor

**Decisión:** una tabla con nombre del trabajo, inicio, duración, resultado (éxito / fallo / omitido), resumen y motivo del fallo.

**Por qué:** la pregunta que hay que poder responder es *"¿cuándo corrió bien por última vez?"*, y los registros del contenedor se rotan y se pierden. Además, tenerlo en la base permite que el diagnóstico sea una consulta y no un raspado de texto.

**Retención:** se conservan los últimos días de historial. **La última ejecución con éxito de cada trabajo nunca se borra**, porque es la que sostiene el diagnóstico — si se limpiara, un trabajo que lleva un mes sin correr parecería no haber corrido nunca, que es un diagnóstico distinto.

### 4. La cadencia se calcula desde la última ejecución, no desde el arranque

**Decisión:** cada trabajo se ejecuta cuando *ahora − última ejecución ≥ su cadencia*, leyendo la última ejecución de la tabla.

**Por qué:** hace el programador **resistente a reinicios**. Con un temporizador en memoria, un despliegue cada pocas horas podría dejar la verificación nocturna sin correr nunca — el proceso se reiniciaría antes de que su temporizador venciera. Con la marca en la base, el trabajo vencido corre en cuanto el programador vuelve.

También es lo que hace cierto el escenario de arranque: se corre **una vez** lo que venció, no una vez por cada intervalo perdido.

### 5. Un tiempo máximo por trabajo

**Decisión:** cada ejecución tiene un tope de duración; superado, se marca como fallida por tiempo agotado.

**Por qué:** sin tope, un trabajo colgado —una consulta que no vuelve, una conexión perdida— retiene su cerrojo y **omite todas las ejecuciones siguientes en silencio**. Sería un fallo que se ve como "trabajo omitido" repetido, sin explicar por qué. El tope convierte eso en un fallo con motivo.

### 6. El trabajo llama a la función, no al script

**Decisión:** el programador invoca `expireStaleOrders()` y las funciones equivalentes directamente. No lanza procesos hijos ni ejecuta comandos de `package.json`.

**Por qué:** un proceso hijo por ejecución cuesta memoria y arranque, y su resultado hay que deducirlo de un código de salida y de texto impreso. Llamando a la función se obtiene el resumen estructurado que la tabla de ejecuciones necesita, y los errores llegan como excepciones con su mensaje.

**Consecuencia:** los comandos de `package.json` siguen existiendo para ejecución manual. **La lógica no se duplica** — programador y comando llaman a la misma función.

## Dónde vive cada cosa

```
src/modules/jobs/
  definitions.ts   los tres trabajos: nombre, cadencia, tope de duración y qué función llaman
  scheduler.ts     decide qué toca, toma el cerrojo, ejecuta con tope y registra
  health.ts        última ejecución con éxito por trabajo y si va atrasado
  cleanup.ts       retención del historial
scripts/outbox-worker.ts   (modificado) el bucle también dispara los trabajos
scripts/jobs-status.ts     consulta por consola
tests/jobs.test.ts         no solapamiento, cadencia desde la última ejecución, registro, atraso
```

**Migración de Prisma:** sí — tabla de ejecuciones de trabajos, con índice por trabajo y fecha.

**Eventos de dominio:** este change no emite ni consume ninguno.

**Pantallas:** ninguna. Igual que el diagnóstico de la bandeja de salida, el consumidor de este dato es hoy el equipo técnico.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Un solo proceso sostiene el worker y el programador** (decisión 1). Si cae, se paran ambos. | Reinicio automático del contenedor, y dos señales independientes que lo delatan: la antigüedad del pendiente más viejo de la bandeja y la última ejecución con éxito de los trabajos. **Disparador para separarlos:** que un trabajo largo empiece a retrasar el consumo de eventos de forma medible. |
| **La expiración cancela ventas reales.** Un criterio equivocado cancela pedidos legítimos, y ahora sin nadie mirando. | La lógica ya existe, está probada y no se toca en este change. Pasa por la máquina de estados: un pedido que no se puede cancelar no se fuerza. Cada ejecución deja constancia de cuántos canceló. |
| **El cerrojo consultivo se libera si el proceso muere**, y una ejecución a medias no se distingue de una que no empezó. | El registro se escribe **al iniciar** y se completa al terminar: una ejecución sin fin registrado es exactamente una que murió a mitad, y se ve. |
| **La verificación del libro contable recorre todo el inventario** y crecerá con el catálogo. | Corre de madrugada y tiene tope de duración. **Disparador para revisar:** que se acerque a su tope. |
| **Nadie mira el diagnóstico.** Sin canal de alertas, el dato existe y no avisa. | Reconocido y declarado fuera de alcance. La consulta termina con código distinto de cero cuando algo va mal, de modo que conectarla a un canal —cuando exista— sea trivial. |

## Migration Plan

1. Migrar el esquema (tabla de ejecuciones).
2. Construir programador, diagnóstico y retención, con sus pruebas.
3. Arrancar el worker en local con cadencias reducidas y observar las tres ejecuciones.
4. Desplegar por el camino automático y comprobar contra el servidor que los trabajos corren y quedan registrados.

**Reversión:** una variable de entorno que desactiva el programador deja el worker consumiendo eventos como hoy. Los trabajos vuelven a ejecutarse a mano, que es la situación actual — sin pérdida.

## Open Questions

- **Días de retención del historial.** Se ajusta viendo el crecimiento real; no cambia specs ni tareas. Punto de partida: unos pocos días.
- **Hora exacta de la verificación nocturna.** Depende de cuándo cae la actividad real de la tienda, que hoy no se puede medir porque no hay tráfico. Punto de partida: madrugada en horario de Colombia.
