## Context

Ver `proposal.md` — Why. Estado que condiciona el diseño:

- **El pedido ya es un snapshot** (`contact*` + `ship*` en `orders`) y hay una prueba que impide que la libreta lo reescriba. Todo consumidor lee esos campos: `invoicing/snapshot.ts` (congela y `pdf.ts` dibuja), `orders/message.ts` (WhatsApp), `buyer/orders.ts` y `(tienda)/cuenta/pedidos/[numero]`, `admin/pedidos/[id]`, `notifications/render.ts`.
- **El país hoy es UNO por formulario** (`baseSchema.country` en `checkout-actions.ts`) y decide a la vez el prefijo del teléfono, el documento, los campos de dirección, los métodos de pago (`PAYMENT_METHODS[country]`) y la validación `ciudadCanonica(country, state, city)`. `SelectorDivisionCiudad` ya sirve los dos países con listas cerradas.
- **La libreta** (`customers/addresses.ts`) guarda `country` CO|US, y el checkout con sesión arranca el `country` del formulario en el de la dirección predeterminada. `customer-link.ts` estrena la libreta con la dirección del pedido si está vacía.
- **El comprobante está congelado** (`SalesDocumentSnapshot` con `version`): los emitidos no se tocan; los nuevos pueden llevar más.
- **La moneda no cambia**: la decide la IP (`modules/geo`) y `activeCurrency()`; el número de WhatsApp destino se elige por moneda (PED_HU002).

## Goals / Non-Goals

**Goals:**
- Dos bloques en el checkout con **una sola definición** de qué campos exige cada país (hoy vive en el `if (data.country === "CO")` de `createOrder`) reutilizada para los dos bloques.
- Que "misma dirección" sea un **hecho guardado** (`shipSameAsBilling`), no una comparación de textos al leer: dos pantallas comparando de forma distinta discreparían.
- Cero reescritura de comprobantes emitidos; los pedidos anteriores se leen como "misma dirección" por backfill, no por lógica especial en cada consumidor.

**Non-Goals:**
- Libreta de facturación. La precarga sale del último pedido, sin tabla ni espejo nuevos.
- Tocar `modules/geo`, `pricing` ni la elección del número de WhatsApp.
- Rediseñar el checkout: los bloques nuevos siguen la maqueta actual de "Tus datos" / "Dirección de entrega" (`Kora.dc.html`, sección Checkout), que es la aprobada.

## Decisions

**1. Un módulo de reglas de dirección por país: `src/modules/orders/address-rules.ts`.**
Hoy la validación por país está inline en `createOrder`. Con dos bloques habría que duplicarla o parametrizarla; se extrae a `validarDireccion(pais, campos)` que devuelve `{ ok } | { ok: false, field, error }` y canoniza la ciudad, y a `validarContacto(pais, campos, { documentoObligatorio })`. La misma función valida facturación (país variable) y envío (país fijo `CO`, documento opcional). *Alternativa descartada:* dos esquemas Zod separados — divergen a la primera columna nueva, que es la lección de `sale-fields.tsx`.

**2. Esquema del formulario: dos objetos anidados, no prefijos planos.**
`baseSchema` pasa a `{ billing: {...}, shipping?: {...}, shipSameAsBilling: boolean }`. `shipping.country` se fuerza a `CO` por esquema (`z.literal("CO")`): una petición con otro país falla en el esquema, no en una comprobación posterior. La vista ya construye el objeto en JS (no hace falta `formDataAnidado()`). **Decisión de Daniel (20 sep):** los campos de envío siempre se ven y se editan, así que el envío **viaja siempre tal como está en pantalla**; `shipSameAsBilling` es solo la marca de que el comprador los dejó iguales (la casilla se desmarca sola al editar). Si `shipping` no viniera con la marca puesta, el servidor lo deriva de `billing` — compatibilidad, no el camino normal. *Alternativa:* `bill_*`/`ship_*` planos — cada campo nuevo se añade en dos sitios.

**3. Columnas nuevas en `orders`, no una tabla de direcciones del pedido.**
`billCountry`, `billState`, `billCity`, `billAddress`, `billAddress2`, `billNeighborhood`, `billZip`, `shipName`, `shipPhone`, `shipDocument`, `shipSameAsBilling Boolean @default(false)`. Los `contact*` siguen siendo el pagador (es quien contacta por WhatsApp y a quien van los correos); `ship*` sigue siendo la entrega. Una tabla `order_addresses` con `kind` sería más "normal" pero rompería la propiedad que hace útil el snapshot: **todo el pedido en una fila**, que es lo que lee el comprobante, el CSV de ventas y el respaldo. **Migración Prisma versionada** con backfill en el mismo archivo SQL: `bill* = ship*`, `shipName = contactName`, `shipPhone = contactPhone`, `shipDocument = contactDocument`, `shipSameAsBilling = true` para todas las filas existentes. **No emite ni consume eventos** de `domain_events`: nada cambia en `order.confirmed`.

**4. `shipCountry` se conserva y vale `CO`.**
Quitarla exigiría tocar todos los consumidores y el CSV de ventas; dejarla con el invariante "siempre CO en pedidos nuevos" (fijado por prueba y por el esquema) cuesta cero y mantiene los pedidos viejos legibles.

**5. El comprobante sube a `version: 2` del snapshot con `billing` además de `shipping` y `sameAddress`.**
`pdf.ts` dibuja *Facturado a* / *Enviado a* si `version >= 2`; con `version 1` dibuja como hoy. Los emitidos no cambian (spec sales-document, escenario "emitido antes"). `buyer` sigue siendo el pagador.

**6. La libreta es de envío y solo de Colombia hacia adelante.**
`addresses.ts` pasa a rechazar `country !== "CO"` al crear/editar (la cuenta deja de ofrecer el selector de país en "Mis direcciones"). Las existentes en US no se borran: `incompleta()` del checkout ya las trata como no elegibles al fallar `ciudadCanonica("CO", …)` — se hace explícito. `customer-link.ts` estrena la libreta con la **dirección de envío**, no con la de facturación, y sigue sin escribir `customer.city/address` (único escritor: `sincronizarDireccionPrincipal`).

**7. Precarga de facturación con sesión: del último pedido.**
`BuyerDefaults` gana `ultimaFacturacion` (los `bill*` + país del pedido más reciente del cliente, o `null`). Lectura pura en `buyer/orders.ts`; sin escritor nuevo. *Alternativa:* guardar `bill*` en `Customer` — sería un segundo espejo con su propia forma de desincronizarse.

**8. `customer.country` pasa a significar país del pagador.**
Ya lo es de facto (se escribía con `data.country`). Se documenta en el esquema y no cambia el módulo de clientes.

**9. UI: dos secciones con el patrón actual, campos controlados.**
Sección 1 **"Datos de facturación"** = la actual "Tus datos" + la dirección (selector de país arriba a la derecha). Sección 2 **"Datos de envío"**: con pagador CO, casilla "Usar los mismos datos de facturación" (marcada) que **precarga** los campos —siempre visibles y editables; tocar uno la desmarca—. Con pagador US no hay casilla. La libreta, solo con sesión, **copia** la dirección elegida en los campos. Para copiar valores los campos de los dos bloques son controlados (`fact`, `envioPropio`), no `defaultValue`. Títulos y comportamiento dictados por Daniel el 20 sep tras ver la primera versión ("Quién paga" + bloque colapsado).

**10. Mensaje de WhatsApp.**
`MessageInput` gana `shipTo?: { name, phone, address: string[] }`; si `shipSameAsBilling`, no se manda y el mensaje queda como hoy. Con destinatario, se añade un bloque "📍 Enviar a" con nombre, celular y dirección, y el bloque del pagador se titula "💳 Paga". Hay pruebas del mensaje que se amplían.

**11. El correo es el de facturación.** `contactEmail` sale del bloque de facturación y el de envío no pide correo: un regalo no se anuncia al destinatario (Daniel, 20 sep). La dirección de facturación no va al chat de WhatsApp —ahí solo importa a dónde se envía—; es dato del panel, del comprobante y, con pasarela, de la validación de la tarjeta.

## Risks / Trade-offs

- **[Un comprador en EE.UU. pone su propio nombre como destinatario y una dirección colombiana inventada para "probar"]** → No es distinto de hoy; el operador confirma por WhatsApp antes de descontar stock.
- **[El backfill marca como "misma dirección" pedidos donde la persona quizá no era la misma]** → Es la única lectura posible: solo existía una dirección y era la del comprador. Los comprobantes ya emitidos no se tocan.
- **[Direcciones US en libretas de pruebas quedan huérfanas]** → Se ven como incompletas y editables; la cuenta permite borrarlas. Producción no tiene datos.
- **[Crece el formulario para el caso Colombia → Colombia, que es el mayoritario]** → No crece: la casilla marcada por omisión deja el checkout exactamente como hoy, más una línea.
- **[Dos definiciones del teléfono del destinatario (+57 fijo) y del pagador (por país)]** → Las dos pasan por `toE164(phone, country)`; el destinatario con `"CO"` fijo.
- **[`pdf.ts` con dos versiones de snapshot]** → Un `if` en un solo sitio y una prueba por versión; la alternativa (migrar snapshots viejos) violaría la regla de congelación.

## Migration Plan

1. Migración Prisma (columnas + backfill en el mismo SQL). Compatible hacia atrás: la app anterior ignora las columnas nuevas.
2. Desplegar código. Los pedidos creados entre migración y despliegue no existen: pruebas se despliega en un solo paso.
3. Rollback: la app anterior sigue funcionando con las columnas extra; no se revierte la migración.
4. Verificación en pruebas: un pedido CO→misma, uno CO→otra persona, uno US→CO; comprobar mensaje de WhatsApp, panel, cuenta, correo de "enviado" y PDF (`pnpm invoice:preview` con los tres).

## Open Questions

- Si el cliente quiere que el documento del destinatario sea obligatorio para alguna transportadora, es un cambio de una línea en `address-rules.ts` (`documentoObligatorio`). No cambia specs ni tareas.
