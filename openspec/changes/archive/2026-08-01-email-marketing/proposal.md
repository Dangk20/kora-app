# Email marketing — Semana 13

**Semana del plan:** **S13 (3–9 oct)**, la siguiente tras S12 cerrada. Es la última semana de módulo antes del congelamiento de alcance (S14).

**HUs:** **EML_HU001 a EML_HU004** (`../hus-email.md`, espejadas en Notion). Alcance firmado §6.

## Why

Es lo que sigue en el cronograma y es lo único que queda del alcance contratado sin construir junto al POS (S9). Se alimenta del módulo de clientes, que ya existe, y del catálogo, que ya existe.

Y hay una razón para hacerlo **ahora y no en octubre**: el módulo depende de un insumo del cliente pendiente desde el 31 de julio —los registros de correo del dominio— y **construirlo revela exactamente qué falta**. Llegar a octubre con el módulo hecho y solo el DNS pendiente es una conversación de un día; llegar con las dos cosas pendientes es perder la semana.

## El bloqueo, dicho con precisión

**`korashopp.com` no tiene registros de correo (MX, SPF, DKIM, DMARC) y no hay cuenta de proveedor de envío.** Sin eso:

- Ningún correo sale de verdad. Los que salieran caerían en spam.
- Sin SPF ni DMARC, **cualquiera puede falsificar correos que digan venir de KORA** — riesgo de marca en una tienda.
- No hay webhooks, así que no hay aperturas, clics, rebotes ni quejas.

**Lo que el cliente tiene que decidir** (dos cosas, ninguna técnica):
1. Si usarán correo corporativo propio (Google Workspace, Zoho…) para `@korashopp.com`.
2. Qué dirección remitente quieren para los correos de la tienda (`hola@`, `tienda@`, `no-responder@`…).

Con eso, configurar el proveedor y publicar los registros es trabajo nuestro de unas horas.

**Este change construye todo lo demás**, y deja el envío real detrás de una interfaz con dos implementaciones —la misma forma que ya resolvió el almacenamiento de imágenes— para que activar el proveedor sea configuración, no desarrollo.

## What Changes

- **Transporte de correo con dos drivers**: en desarrollo escribe los correos a disco (se abren y se leen); en producción, el proveedor. Sin proveedor configurado, **en producción la aplicación no arranca** — igual que con las imágenes.
- **Plantilla de marca única**, la misma para la vista previa y el envío. Sin HTML libre (decisión del cliente, 19 jul).
- **Campañas**: listado con estados, creación con contenido y productos destacados, programación, cancelación, duplicado y detalle de solo lectura.
- **Segmentación combinable** con conteo estimado en vivo: país, actividad, cuenta y categoría comprada.
- **Envío por lotes**, reanudable y sin duplicar, sobre el worker que ya existe.
- **Consentimiento y desuscripción**: estado auditable del cliente, enlace de un clic con token firmado, página pública de baja y re-suscripción, y supresión automática por rebote duro o queja de spam.

## Desvío del plan técnico, declarado

El plan técnico (§ tabla de stack y §S13) dice **BullMQ sobre Redis** para el envío masivo. **Este change no lo usa**, y conviene que quede escrito por qué:

Cuando se escribió el plan no existía nada que procesara trabajo en segundo plano. Hoy sí: hay un worker de larga duración con bandeja de salida, reintentos con espera creciente, muerte terminal, recuperación de huérfanos y un programador de trabajos con cerrojo en base. Un envío por lotes es exactamente eso.

Meter BullMQ ahora significaría **dos sistemas de cola conviviendo**, cada uno con su forma de fallar, su diagnóstico y su memoria, en un VPS que ya tiene comprometidos 6 de sus 8 GB. La regla del proyecto es simplicidad antes que potencia, y aquí la potencia extra no compra nada: 10.000 correos en lotes con espera controlada es un bucle, no un problema de encolamiento.

**Lo que sí hay que conservar del plan es el DoD, no la herramienta**: una campaña de 10.000 correos no puede degradar la tienda. Se consigue igual —el envío corre fuera del proceso web, en lotes, con pausa entre ellos— y se declara como requisito verificable.

Si algún día hace falta paralelismo real entre varias campañas, BullMQ sigue estando disponible y el cambio queda acotado al despachador.

## Capabilities

### New Capabilities

- `email-delivery`: cómo sale un correo — la interfaz, los dos drivers, la guarda de arranque, y por qué un destinatario no puede recibir dos veces el mismo envío.
- `email-campaigns`: la campaña — contenido congelado, segmentación, estados, programación y envío por lotes reanudable.
- `email-consent`: quién puede recibir — consentimiento auditable, desuscripción de un clic y supresión automática.

### Modified Capabilities

Ninguna capacidad publicada cambia: `openspec/specs/` sigue vacío porque los changes anteriores no se han archivado.

## Fuera de alcance

- **La entrega real y los webhooks del proveedor.** Bloqueado (arriba). El manejador de eventos de entrega **sí** se construye y se prueba; lo que queda fuera es la ruta HTTP que el proveedor llama, porque su contrato de firma no se puede verificar sin la cuenta.
- **Métricas de apertura y clic.** Llegan por webhook. Los contadores existen y la pantalla los muestra en cero con su motivo, en vez de inventar un número.
- **Correos transaccionales** (confirmación de pedido, aviso de cashback por vencer). No están en el alcance firmado §6 y merecen su propio change: son otro tipo de correo —no dependen de la suscripción— y otra conversación con el cliente.
- **A/B testing, automatizaciones y centro de preferencias.** Declarados fuera en las propias HUs.
- **Cambiar el checkbox de consentimiento del checkout.** Ver decisiones pendientes.

## Decisiones que quedan para Daniel

**El checkbox del checkout no coincide con EML_HU004 §1, y el código está hoy del lado más seguro.**

- **La HU dice**: un solo checkbox **marcado por defecto y obligatorio** que junta política de datos y suscripción a promociones (decisión del 19 jul).
- **El código hace**: dos checkboxes — tratamiento de datos obligatorio, promociones **opcional y desmarcado**.

La diferencia es legal, no cosmética: la Ley 1581 espera consentimiento de marketing **previo, expreso y no condicionado a la compra**, y el riesgo ya está registrado en las notas privadas. Cambiarlo a lo que dice la HU es un ajuste de tres líneas en el checkout, pero **es empeorar la posición legal a propósito**, y esa decisión no se toma dentro de un change técnico.

Este change **deja el consentimiento auditable funcionando con cualquiera de las dos formas**: registra qué aceptó el comprador, cuándo y por qué vía. Cambiar la estructura del checkbox después no toca el módulo.

## Bloqueos declarados

1. **Registros de correo del dominio + proveedor de envío** — insumo del cliente pendiente desde el 31 jul. Bloquea: entrega real, webhooks, métricas de apertura/clic/rebote. **No bloquea** nada más de este change.
2. **Texto de la política de tratamiento de datos** — el contenido lo provee el cliente. El pie legal del correo enlaza a la página; la página existe con un texto provisional marcado como tal.

## Impact

**Archivos nuevos**
- `src/modules/email/` — transporte, drivers, plantilla de marca, guarda de arranque
- `src/modules/campaigns/` — contenido, segmentación, envío por lotes, métricas
- `src/modules/consent/` — suscripción, token de baja, supresión
- `src/app/admin/campanas/` — el panel
- `src/app/(tienda)/suscripcion/` — la página pública de baja
- `tests/email.test.ts`, `tests/campaigns.test.ts`, `tests/consent.test.ts`

**Archivos modificados**
- `prisma/schema.prisma` + migración — la campaña pasa de esbozo a modelo real
- `src/modules/jobs/definitions.ts` — el despachador de envíos y el disparo de programadas
- `src/instrumentation.ts` — la guarda de arranque del correo
- Módulo de clientes — el estado de suscripción en el perfil
- `src/modules/orders/checkout-actions.ts` — registro auditable del consentimiento

**Reglas del proyecto que este change NO puede violar**
- **`resolvePrice()` es la única fuente de precio**, también dentro de un correo.
- **Toda acción del panel usa `requirePermission`**; los permisos `marketing:view/create/send` ya existen en la matriz.
- **Las dos monedas no se convierten**: una campaña a audiencia mixta no puede inventar un precio común.
- **Las imágenes se sirven desde R2**, nunca desde el VPS — y en un correo, menos: el cliente de correo las pide desde fuera.

**Riesgo principal**
Un envío que se duplique le llega **dos veces al comprador**, y eso no se puede deshacer: quema la reputación del dominio justo cuando se está construyendo. La idempotencia por destinatario se fija con prueba, incluida la reanudación tras una caída a mitad de campaña.
