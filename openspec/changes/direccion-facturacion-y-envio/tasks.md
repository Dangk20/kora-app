## 1. Datos

- [x] 1.1 Columnas nuevas en `Order` (`prisma/schema.prisma`): `billCountry`, `billState`, `billCity`, `billAddress`, `billAddress2`, `billNeighborhood`, `billZip`, `shipName`, `shipPhone`, `shipDocument`, `shipSameAsBilling Boolean @default(false)`; documentar que `contact*` es el pagador, `ship*` la entrega y `shipCountry` vale siempre `CO` en pedidos nuevos. Documentar en `Customer.country` que es el país del pagador.
- [x] 1.2 Migración versionada que añade las columnas **y hace el backfill en el mismo SQL**: `bill* = ship*`, `shipName = contactName`, `shipPhone = contactPhone`, `shipDocument = contactDocument`, `shipSameAsBilling = true` para todas las filas existentes.
- [x] 1.3 `pnpm db:migrate`, reiniciar `pnpm dev` (cliente de Prisma viejo en memoria) y comprobar el backfill contra la base local: ningún pedido con `bill*` nulo teniendo `ship*`.

## 2. Reglas por país — `src/modules/orders/address-rules.ts`

- [x] 2.1 `validarDireccion(pais, campos)`: departamento/estado, ciudad canónica (`ciudadCanonica`), barrio obligatorio en CO, ZIP `#####`/`#####-####` en US; devuelve `{ ok: true, city }` o `{ ok: false, field, error }`. Sacar de `createOrder` el `if (data.country === "CO") … else …` y hacer que lo use.
- [x] 2.2 `validarContacto(pais, campos, { documentoObligatorio })`: celular de 10 dígitos en CO, documento ≥ 5 dígitos cuando es obligatorio; E.164 con `toE164`.
- [x] 2.3 Pruebas de las reglas con los dos países y el documento opcional/obligatorio (`tests/direcciones-pedido.test.ts`, lógica pura).

## 3. Crear el pedido — `src/modules/orders/checkout-actions.ts`

- [x] 3.1 Esquema anidado `{ billing, shipping?, shipSameAsBilling }` con `shipping.country` como `z.literal("CO")`; `formDataAnidado()` para recoger `billing.address`, `shipping.city`, … del `FormData`.
- [x] 3.2 Con `shipSameAsBilling = true`, `shipping` se deriva de `billing` en servidor (y solo se admite si `billing.country === "CO"`); con `false`, `shipping` es obligatorio y se valida con las reglas de 2.x (documento del destinatario opcional).
- [x] 3.3 Snapshot completo en `tx.order.create`: `contact*` + `bill*` del pagador; `ship*` + `shipName/shipPhone/shipDocument` del destinatario; `shipSameAsBilling`.
- [x] 3.4 `resolveOrderCustomer` recibe país/ciudad/dirección del **pagador** para `customer.country/city/address`, y la dirección de **envío** para estrenar la libreta (`customer-link.ts`).
- [x] 3.5 Pruebas en `tests/orders.test.ts` (o archivo nuevo): CO→misma (copia y marca), CO→otra persona, US→CO, petición con `shipping.country = "US"` rechazada, `shipSameAsBilling` con pagador US rechazado, celular del destinatario inválido señalado.

## 4. Mensaje de WhatsApp — `src/modules/orders/message.ts`

- [x] 4.1 `MessageInput.shipTo?` con nombre, celular y dirección en líneas; bloque "📍 Enviar a" solo cuando no es la misma dirección; el bloque del pagador pasa a "💳 Paga" en ese caso.
- [x] 4.2 Ampliar las pruebas del mensaje: misma dirección (mensaje idéntico al actual) y destinatario distinto.

## 5. El checkout — `src/app/(tienda)/checkout/`

- [x] 5.1 Sección "Quién paga": la actual "Tus datos" + su dirección (selector de país donde está hoy); nombres de campo `billing.*`. Métodos de pago por país del pagador.
- [x] 5.2 Sección "A dónde se envía": casilla "Enviar a esta misma dirección" (marcada por omisión) **solo si el pagador está en Colombia**; desmarcada o con pagador en EE.UU., se monta el bloque colombiano con nombre, celular (+57 fijo), documento opcional y `SelectorDivisionCiudad` con `country="CO"`. El bloque colapsado no existe en el DOM.
- [x] 5.3 Libreta solo en el bloque de envío: selector de direcciones guardadas, "usar otra", "guardar en mi cuenta"; una dirección con país distinto de CO se muestra como incompleta y no elegible.
- [x] 5.4 `BuyerDefaults.ultimaFacturacion` (lectura en `buyer/orders.ts` del pedido más reciente) y precarga del bloque de facturación con sesión.
- [x] 5.5 Errores de campo con la ruta anidada (`billing.city`, `shipping.phone`) señalando el bloque correcto.
- [x] 5.6 Pase manual en local de los tres casos (CO→misma, CO→otra, US→CO) con captura del mensaje de WhatsApp y del pedido creado.

## 6. Libreta — `src/modules/customers/addresses.ts` y la cuenta

- [x] 6.1 Crear/editar rechazan `country !== "CO"`; la sección "Mis direcciones" deja de ofrecer el selector de país y pide siempre el formulario colombiano.
- [x] 6.2 Ajustar `tests/libreta-direcciones.test.ts`: desaparece el escenario de cambio de país; entra el rechazo de US.

## 7. Comprobante — `src/modules/invoicing/`

- [x] 7.1 `SalesDocumentSnapshot` `version: 2` con `billing` y `sameAddress`; `freezeSalesDocument` los toma del pedido.
- [x] 7.2 `pdf.ts`: con `version >= 2`, bloques *Facturado a* / *Enviado a*, o uno solo con "Entrega a la misma dirección"; con `version 1`, exactamente como hoy.
- [x] 7.3 `scripts/preview-invoice.ts`: ejemplos de los tres casos. Pruebas en `tests/comprobante.test.ts`: snapshot v2 congela las dos, un snapshot v1 sigue renderizando igual.

## 8. Lo que muestra el pedido

- [x] 8.1 Panel `admin/pedidos/[id]`: tarjeta "Paga" y tarjeta "Envío a", o una sola con la marca de misma dirección; el listado no cambia.
- [x] 8.2 Cuenta del comprador `(tienda)/cuenta/pedidos/[numero]` y `buyer/orders.ts`: lo mismo.
- [x] 8.3 `notifications/render.ts`: el correo de "enviado" nombra al destinatario y la ciudad cuando no es el pagador; `pnpm emails:preview` incluye ese caso. Prueba en `tests/notifications.test.ts`.

## 9. Documentación y cierre

- [x] 9.1 `CLAUDE.md` (sección Pedidos/Libreta) y `notas-tecnicas-privado.md`: alcance nuevo sin HU, decisión "envío siempre Colombia", documento del destinatario opcional, deuda de reescribir PED_HU001 §3.
- [x] 9.2 `pnpm typecheck && pnpm lint && pnpm build && pnpm test` en verde (cerrar `pnpm dev` antes de la suite, con permiso de Daniel).
- [x] 9.3 Bitácora de sprints actualizada y push a `main` (despliega a pruebas); verificar los tres casos en `test.korashopp.com`.
