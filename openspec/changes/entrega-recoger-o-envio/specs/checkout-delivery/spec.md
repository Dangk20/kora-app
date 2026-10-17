## Purpose

Cómo elige el comprador entre recoger su pedido en la tienda de Neiva y recibirlo con envío, qué pide cada camino y qué queda congelado en el pedido.

## ADDED Requirements

### Requirement: La primera pregunta del checkout es el método de entrega

El checkout SHALL empezar preguntando cómo quiere recibir el pedido, con dos opciones: **Recoger en tienda**, marcada **SOLO EN NEIVA**, y **Envío a domicilio**. Hasta que el comprador responda, el resto del formulario NO SHALL mostrarse y el pedido NO SHALL poder crearse. El servidor SHALL rechazar un pedido sin método de entrega.

#### Scenario: Llega al checkout
- **WHEN** el comprador abre el checkout con productos en el carrito
- **THEN** ve solo la pregunta del método de entrega y el resumen del pedido

#### Scenario: Elige un método
- **WHEN** elige una de las dos opciones
- **THEN** se despliega el formulario de ese camino y puede cambiar de opción sin perder los datos de facturación escritos

#### Scenario: Petición sin método
- **WHEN** llega una petición de crear pedido sin `deliveryMethod`
- **THEN** se rechaza señalando el campo `deliveryMethod`

### Requirement: Recoger en tienda no pide dirección de entrega

Con **Recoger en tienda** el checkout SHALL pedir la facturación, **quién recoge** y la preferencia de pago, y NO SHALL pedir dirección de entrega. Con pagador en Colombia, por omisión recoge quien paga; el comprador SHALL poder indicar otra persona con nombre, celular colombiano (+57) y documento opcional. Con pagador en EE.UU. SHALL indicar quién recoge.

El checkout SHALL mostrar la dirección y el horario de la tienda (por omisión Calle 25 Sur # 32-23, Neiva, de 9:00 a. m. a 6:00 p. m.; el entorno los puede cambiar). Si el entorno los deja en blanco, SHALL decir que se confirman por WhatsApp.

**Invariante:** un pedido `PICKUP` guarda a quien recoge en `shipName`/`shipPhone`/`shipDocument`, con `shipCountry = CO`, `shipCity = Neiva` y sin `shipAddress`.

#### Scenario: Recoge quien paga
- **WHEN** un pagador en Colombia elige recoger y deja "La recojo yo"
- **THEN** el pedido queda `PICKUP` con quien recoge igual a quien paga

#### Scenario: Recoge otra persona
- **WHEN** el pagador está en EE.UU., o desmarca "La recojo yo", y escribe nombre y celular de otra persona
- **THEN** el pedido queda `PICKUP` con esa persona como quien recoge

#### Scenario: Celular inválido de quien recoge
- **WHEN** el celular de quien recoge no es un celular colombiano válido
- **THEN** se rechaza señalando `pickup.phone`

### Requirement: Envío a domicilio queda como hoy

Con **Envío a domicilio** el checkout SHALL comportarse exactamente como antes de este cambio (facturación, envío en Colombia, libreta, "mismos datos") y el pedido SHALL quedar `SHIPPING`.

#### Scenario: Envío
- **WHEN** el comprador elige envío y llena el formulario
- **THEN** el pedido queda `SHIPPING` con la dirección de envío, igual que antes

### Requirement: Cada consumidor dice cómo se entrega

El mensaje de WhatsApp, el comprobante, los correos, el panel de pedidos y la cuenta del comprador SHALL decir **Recoger en tienda (Neiva)** y quién recoge cuando el pedido es `PICKUP`, en vez de una dirección. Los pedidos y comprobantes anteriores a este cambio SHALL seguir mostrándose como envío.

#### Scenario: Mensaje de WhatsApp de un pedido para recoger
- **WHEN** se crea un pedido `PICKUP`
- **THEN** el mensaje dice "🏬 Recoger en tienda (Neiva)" y, si recoge otra persona, su nombre y celular, y no lleva bloque de dirección

#### Scenario: Comprobante anterior
- **WHEN** se dibuja un comprobante emitido antes de este cambio
- **THEN** se ve como se emitió, con su bloque de envío
