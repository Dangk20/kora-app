## 1. Esquema y ajustes

- [x] 1.1 Tabla del registro de envíos: pedido, tipo de correo, destinatario, cuándo, y el resultado del proveedor. **Índice único por (pedido, tipo)** — es la garantía de no duplicar, no una comprobación optimista.
- [x] 1.2 Migración versionada y aplicada.
- [x] 1.3 Clave de ajuste con la dirección del negocio y su comando `pnpm staff:email`. **Sin pantalla de Configuración todavía** — igual que el número de WhatsApp, que sigue fijándose por comando.

## 2. A quién se le puede escribir

- [x] 2.1 `src/modules/notifications/guard.ts`: la baja de marketing frena **solo** campañas; la dirección no utilizable frena **todo**. Devuelve el motivo cuando dice que no.
- [x] 2.2 Pruebas: un dado de baja **sí** recibe el correo de su pedido; una dirección con rebote **no** recibe nada; un pedido sin correo no es un error.
- [x] 2.3 Comprobado que separar las listas no debilita las campañas: `canSendMarketing()` sigue exigiendo suscripción **y** dirección utilizable, y las 53 pruebas del módulo de correo siguen en verde sin tocar `audience.ts`.

## 3. Qué dice cada correo

- [x] 3.1 Extender la plantilla de marca para el pedido: líneas, totales en **su moneda**, y botón. Sin pie de baja cuando es transaccional.
- [x] 3.2 `render.ts`: pedido recibido (con el enlace de WhatsApp), confirmado (con el cashback acreditado y su vencimiento), enviado, y cancelado o expirado (con el cashback devuelto si lo hubo).
- [x] 3.3 Aviso al operador: número, cliente, total y **enlace directo al pedido en el panel**.
- [x] 3.4 Prueba: los importes de un pedido en dólares salen en dólares; el correo de campaña conserva su pie de baja y el transaccional no lo lleva.

## 4. Enviar sin duplicar

- [x] 4.1 `send.ts`: **reservar primero** en el registro, y solo entonces entregar al proveedor. Si la reserva choca con el índice, otro se encargó: salir en silencio.
- [x] 4.2 Guardar el resultado del proveedor sobre la reserva, para poder diagnosticar sin adivinar.
- [x] 4.3 Prueba: el mismo evento dos veces manda **un** correo; dos procesos a la vez mandan **uno**; un fallo del proveedor no deja el registro impidiendo el reintento.

## 5. Los eventos del pedido

- [x] 5.1 `createOrder()` escribe `order.created` **dentro de su transacción**.
- [x] 5.2 Los cambios de estado escriben `order.shipped` y `order.cancelled`, tanto desde el panel como desde la expiración automática.
- [x] 5.3 Manejadores registrados en el worker, uno por momento, todos idempotentes.
- [x] 5.4 Prueba **de que el correo no rompe la venta**, en dos partes porque `createOrder()`/`confirmOrder()` necesitan una petición y una sesión para invocarse: (a) **estructural** — se comprueba que `checkout-actions.ts`, `actions.ts` y `expire.ts` NO importan el módulo de envío ni eligen driver, que es la garantía real; (b) con el proveedor caído, el manejador falla para que la bandeja reintente y **el pedido queda intacto**.
- [x] 5.5 Punta a punta: los dos manejadores de `order.created` mandan los dos correos (prueba con driver falso), y **`pnpm emails:preview`** escribe un ejemplo real de los cinco en `.emails/` — que además es lo que permite al cliente aprobarlos antes de que el dominio tenga sus registros.

## 6. Documentación y cierre

- [x] 6.1 `src/modules/notifications/README.md`: las dos listas, por qué se reserva antes de enviar y por qué nada sale desde la acción.
- [x] 6.2 Actualizar el `CLAUDE.md` de la app y la bitácora.
- [x] 6.3 Anotar en `../notas-tecnicas-privado.md` que **esto es alcance nuevo, fuera de la cotización**, y que la decisión de cobrarlo o absorberlo es de Daniel.
- [x] 6.4 Declarar el pendiente de escribir las HUs.
- [x] 6.5 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde.
