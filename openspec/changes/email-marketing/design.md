# Diseño — Email marketing (S13)

## Context

Motivación, bloqueo y el desvío respecto de BullMQ, en `proposal.md`. Requisitos en `specs/`.

**Lo que ya existe y define la forma de este change:**

- **El worker de larga duración** con bandeja de salida y programador de trabajos, con cerrojo en base, reintentos y parada ordenada. Un envío por lotes es un trabajo más.
- **El patrón de drivers del almacenamiento**: interfaz, driver de disco en desarrollo, driver remoto en producción, elección por variables de entorno y **guarda al arrancar**. Este módulo lo repite entero.
- **El módulo de clientes** con sus agregados: actividad por pedidos confirmados y categorías compradas. La segmentación no inventa consultas nuevas, reusa las que ya alimentan el perfil del cliente.
- **`resolvePrice()`** como única fuente de precio, también dentro de un correo.
- **La matriz de permisos** ya contiene `marketing:view`, `marketing:create` y `marketing:send`, y el rol `marketing`. No hay que crear nada.
- **El esbozo de `Campaign` y `CampaignRecipient`** del modelado inicial, que se queda corto: no tiene bloques de contenido, ni copia inmutable, ni progreso, ni contadores.

## Goals / Non-Goals

**Goals**

- Que activar el proveedor sea **configuración, no desarrollo**.
- Que un comprador no reciba el mismo correo dos veces, ni siquiera reanudando tras una caída.
- Que dar de baja funcione de inmediato y sin fricción.

**Non-Goals de diseño**

- **La ruta HTTP del webhook.** Su contrato de firma no se puede verificar sin la cuenta. El **efecto** de un aviso de entrega sí se construye y se prueba.
- **Aperturas y clics.** Vienen del proveedor.
- **Correos transaccionales.** No están en el alcance §6.
- **Paralelismo entre campañas.** Una a la vez es suficiente para este negocio, y sobra margen.

## Decisions

### 1. El envío es un trabajo programado, no una cola nueva

**Decisión:** un trabajo `campaigns:dispatch` que corre cada minuto, toma la campaña en Enviando más antigua, procesa un lote acotado de destinatarios pendientes y termina. La siguiente ejecución continúa.

**Por qué:** el trabajo pesado ya tiene dónde correr. Con el programador que existe se hereda gratis lo caro de construir: cerrojo para que no corran dos a la vez, registro de ejecuciones, tope de duración y diagnóstico. La alternativa —BullMQ— traería un segundo sistema de cola con su propia forma de fallar, en una máquina que ya tiene comprometidos 6 de sus 8 GB.

**Coste aceptado:** los lotes van uno detrás de otro, no en paralelo. Con lotes de 50 y un ciclo por minuto son 3.000 correos por hora; diez mil tardan poco más de tres horas. Para una tienda que envía promociones, es de sobra. Si algún día no lo fuera, subir el tamaño del lote o el ritmo del ciclo es un número, no un rediseño.

### 2. La reanudación se apoya en el destinatario, no en un contador de progreso

**Decisión:** cada destinatario es una fila con su propio estado. El lote siguiente son "los pendientes de esta campaña", tomados con bloqueo que salta lo ya tomado.

**Por qué:** un contador de "por dónde iba" es un segundo estado que se desincroniza en cuanto el proceso muere entre enviar y guardar el avance — y lo que se desincroniza aquí son correos duplicados. Preguntando por el estado de cada destinatario, la reanudación es exacta por construcción y no hace falta recordar nada.

Es el mismo razonamiento que hizo que la acreditación del cashback se comprobara contra el libro y no contra una marca.

### 3. El estado del destinatario se reserva ANTES de enviar

**Decisión:** el despachador marca el destinatario como "en envío" en su propia transacción, y solo después llama al proveedor. Si el envío falla, se marca fallido; si el proceso muere, queda "en envío" y un barrido lo devuelve a pendiente pasado un tiempo.

**Por qué:** al revés —enviar y luego marcar— un proceso que muere justo después de que el proveedor aceptó el correo deja al destinatario como pendiente, y la reanudación se lo manda otra vez. Marcando antes, el peor caso es que alguien **no** reciba un correo; marcando después, el peor caso es que lo reciba dos veces. Entre los dos, el que se puede corregir es el primero.

**Coste aceptado:** un correo puede perderse si el proceso muere en el instante exacto entre marcar y enviar. Es aceptable para una promoción y es la misma disyuntiva que resuelve la bandeja de salida al revés, porque allí lo que se pierde es un evento de negocio y aquí, un anuncio.

### 4. El token de baja se firma, no se guarda

**Decisión:** el enlace lleva el identificador del cliente y una firma; validarlo es recalcular la firma.

**Por qué:** guardar un token por cliente obligaría a generarlo, almacenarlo, buscarlo y decidir cuándo caduca. Firmarlo no necesita nada de eso y es infalsificable sin el secreto. Un token de baja no necesita revocación: el efecto que produce es precisamente el que el cliente quiere.

**Sin caducidad, a propósito:** un enlace de baja que expira es un enlace de baja roto, y quien lo encuentre roto se queja en vez de darse de baja.

### 5. El contenido se guarda como bloques, y su copia inmutable como HTML ya resuelto

**Decisión:** en borrador, el contenido vive como campos estructurados (asunto, título, texto, imagen, productos, botón). Al enviar, se renderiza una vez y se guarda el HTML resultante junto a la campaña.

**Por qué:** en borrador hacen falta los campos, porque se editan y se validan uno a uno. Enviado, hace falta exactamente lo contrario: lo que se mandó, tal cual, sin depender de que el catálogo, los precios o la plantilla sigan siendo los de aquel día.

### 6. La supresión se comprueba dos veces y la segunda decide

**Decisión:** al construir la audiencia se excluyen bajas y correos no utilizables; al enviar cada lote se vuelve a comprobar, contra el estado actual.

**Por qué:** entre armar la audiencia y enviar el último lote pueden pasar horas. La primera comprobación evita trabajo; la segunda evita la queja. Cuesta una consulta por lote.

### 7. Sin proveedor, el panel dice la verdad en vez de mostrar ceros

**Decisión:** las métricas que dependen del proveedor se muestran como no disponibles, con el motivo, y no como cero.

**Por qué:** un cero en "aperturas" se lee como "nadie lo abrió", y sobre esa lectura se toman decisiones comerciales. Decir "esto todavía no se mide, y por qué" es información; un cero es una afirmación falsa.

## Dónde vive cada cosa

```
src/modules/email/
  config.ts     qué variables hacen falta y la guarda de arranque
  driver.ts     la interfaz
  file-driver.ts   desarrollo: escribe el correo a disco, legible
  resend-driver.ts producción
  index.ts      elección del driver
  template.ts   la plantilla de marca: HTML + texto plano, un solo generador
src/modules/campaigns/
  status.ts     transiciones permitidas
  content.ts    los bloques, su validación y el render
  audience.ts   los filtros, el conteo y la construcción de la lista
  dispatch.ts   el despachador por lotes
  queries.ts / actions.ts
src/modules/consent/
  token.ts      el enlace firmado
  subscription.ts  suscribir, dar de baja, re-suscribir, con su registro
  suppression.ts   rebotes y quejas
src/app/admin/campanas/
src/app/(tienda)/suscripcion/
```

**Migración:** la campaña pasa de esbozo a modelo real (bloques, copia inmutable, contadores, progreso); el destinatario gana estado de intento y motivo de fallo; el cliente gana el registro auditable de su suscripción.

**Eventos:** ninguno nuevo. El envío no pasa por la bandeja de salida: no es una consecuencia de un hecho de negocio, es una acción que el operador dispara.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Un correo duplicado quema la reputación del dominio**, y no se puede deshacer. | Estado por destinatario reservado antes de enviar, tomado con bloqueo que salta lo ocupado. Fijado con prueba, incluida la reanudación. |
| **Enviar a alguien que se dio de baja** genera una queja, que pesa más que la baja. | Doble barrera: al armar la audiencia y al enviar cada lote. |
| **El módulo se construye contra un proveedor que todavía no existe.** | El driver de disco permite probar todo el camino menos la entrega. La interfaz es mínima a propósito: cuanto menos asuma del proveedor, menos habrá que rehacer. |
| **La plantilla se ve mal en algún cliente de correo.** No hay forma de verificarlo sin enviar de verdad. | HTML conservador (tablas, estilos en línea) y versión de texto plano siempre. Queda anotado que la verificación real es parte de activar el proveedor. |
| **El conteo de audiencia es lento** con muchos clientes. | Se cuenta con agregación, no trayendo filas. Con el tamaño de base de este negocio sobra; queda anotado el umbral. |
| **El operador envía a toda la base sin querer.** | El conteo se muestra antes y la confirmación lo repite. Es lo único que separa segmentar de hacer spam. |

## Migration Plan

1. Esquema: campaña real, destinatario con estado, suscripción auditable.
2. **Transporte y plantilla, con sus pruebas, antes de cualquier pantalla.**
3. Consentimiento y baja: token, página pública, supresión.
4. Segmentación y conteo.
5. Despachador por lotes, con la prueba de reanudación.
6. El panel.

**Reversión:** sin campañas creadas, el módulo es inerte. La guarda de arranque solo aplica en producción, así que no puede impedir un despliegue de emergencia si se retira la variable.

## Open Questions

- **¿Qué dirección remitente quiere el cliente?** Bloquea la activación, no este change.
- **¿El checkbox del checkout se cambia a lo que dice EML_HU004?** Decisión de Daniel; el módulo funciona con cualquiera de las dos formas.
- **¿Quién escribe la política de tratamiento de datos?** El pie del correo enlaza a la página; hoy tiene un texto provisional marcado como tal.
