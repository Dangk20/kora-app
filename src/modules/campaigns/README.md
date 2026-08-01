# Campañas de correo

EML_HU001–004. Requisitos: `openspec/changes/email-marketing/specs/`.

## Lo que este módulo garantiza

**Un destinatario no recibe dos veces el mismo envío.** Un correo duplicado no
se deshace: le llega al comprador, lo lee como descuido, y las quejas que genera
queman la reputación del dominio justo cuando se está construyendo.

Tres piezas lo sostienen:

1. **El progreso no es un contador**, es el estado de cada destinatario. Un
   contador de "por dónde iba" se desincroniza en cuanto el proceso muere entre
   enviar y guardar el avance.
2. **El lote se toma con `FOR UPDATE SKIP LOCKED`**: dos despachadores no pueden
   tomar el mismo destinatario. Leer no es reservar.
3. **Se reserva ANTES de llamar al proveedor.** Al revés, un proceso que muere
   justo después de que el proveedor aceptó el correo dejaría al destinatario
   como pendiente y la reanudación se lo mandaría otra vez. Reservando antes, el
   peor caso es que alguien **no** reciba un correo; al revés, que lo reciba dos
   veces. De los dos, el corregible es el primero.

**Una campaña solo empieza a enviarse una vez.** El disparo puede venir del
operador y del trabajo programado a la vez; la garantía es una escritura
condicional sobre el estado, en la base.

**La audiencia y el contenido se congelan al enviar.** Sin lista congelada no se
puede responder "¿a quién le llegó?", que es la pregunta que se hace cuando
alguien se queja. Y el HTML se guarda tal cual salió: un producto que cambia de
precio no puede alterar un correo ya enviado.

## Los archivos

| Archivo | Qué hace |
|---|---|
| `types.ts` | Tipos y topes, **sin dependencias**: lo que el formulario del panel puede importar |
| `status.ts` | Transiciones permitidas; el estado nunca retrocede |
| `audience.ts` | Filtros combinables, conteo y congelado de la lista |
| `content.ts` | Validación y render; los precios por `resolvePrice()` |
| `send.ts` | Iniciar el envío y disparar las programadas |
| `dispatch.ts` | El despachador por lotes, reanudable |
| `queries.ts` / `actions.ts` | Lectura del panel y acciones con `requirePermission` |

⚠️ `types.ts` existe porque el formulario es un componente de cliente: si tomara
el tipo del segmento de `audience.ts` arrastraría Prisma al navegador y el build
falla.

## Por qué NO hay BullMQ

El plan técnico proponía BullMQ sobre Redis. Cuando se escribió no existía nada
que procesara trabajo en segundo plano; hoy sí: el worker con su programador,
cerrojo en base, reintentos y diagnóstico. Un envío por lotes es eso.

Añadir BullMQ sería **dos sistemas de cola conviviendo**, cada uno con su forma
de fallar, en un VPS que ya tiene comprometidos 6 de sus 8 GB. Lo que se conserva
del plan es el DoD, no la herramienta: el envío corre fuera del proceso web, en
lotes, y no degrada la tienda.

Ritmo actual: lotes de 50 cada minuto ≈ 3.000 correos/hora. Diez mil tardan poco
más de tres horas. Si alguna vez no bastara, es un número (`CAMPAIGN_BATCH`), no
un rediseño.

## Doble barrera de supresión

La elegibilidad se comprueba **al armar la audiencia** y otra vez **al enviar
cada lote**. Entre las dos pueden pasar horas: quien se da de baja en ese
intervalo y aun así recibe tiene razón en quejarse, y esa queja pesa más que la
baja porque la registra el proveedor de correo del destinatario contra el dominio
entero.

## Lo que todavía no está

- **La entrega real y los webhooks.** Bloqueado por los registros de correo del
  dominio y la cuenta del proveedor.
- **Aperturas, clics, entregas confirmadas y rebotes.** Llegan por webhook. El
  panel dice que no están disponibles **y por qué**, en vez de mostrar ceros: un
  cero se lee como "nadie lo abrió" y sobre eso se toman decisiones comerciales.
- **La ruta HTTP del webhook.** El efecto de un aviso de entrega sí existe y está
  probado (`consent/suppression.ts`); lo que falta es la capa que lo recibe,
  porque su firma no se puede verificar sin la cuenta.
