## MODIFIED Requirements

### Requirement: El comprobante queda congelado en el momento de emitirse

El comprobante SHALL guardar su propio contenido —datos del comerciante, datos
del comprador, **dirección de facturación y dirección de envío**, líneas con
cantidad y precio unitario, descuentos, cashback aplicado y totales— tal como
estaban al emitirlo. Cambios posteriores en el catálogo, en el cliente, en su
libreta de direcciones o en los datos del comerciante NO SHALL alterar un
comprobante ya emitido.

El comprobante SHALL mostrar *Facturado a* (quien paga, con su dirección) y
*Enviado a* (quien recibe, con la suya) como bloques distintos. Cuando el pedido
está marcado como "misma dirección", SHALL mostrar un solo bloque y decir que la
entrega es a la misma dirección, en vez de repetirla.

**Invariante:** es la misma razón por la que el pedido lleva su propio snapshot,
llevada un paso más allá: el pedido congela lo que se cobró; el comprobante
congela además **quién lo cobró, a nombre de quién y a quién se le entregó**,
que es lo que un documento de respaldo tiene que sostener años después.

#### Scenario: El producto cambia de precio o de nombre

- **WHEN** después de emitido el comprobante el producto cambia de precio, de
  nombre, o se archiva
- **THEN** el comprobante sigue mostrando el nombre y el precio que tenía la
  compra

#### Scenario: El comprador cambia su dirección

- **WHEN** el comprador edita o borra la dirección con la que compró
- **THEN** el comprobante conserva la facturación y la dirección a la que se envió

#### Scenario: Cambian los datos del comerciante

- **WHEN** cambia la razón social, el NIT o el domicilio del comerciante
- **THEN** los comprobantes ya emitidos conservan los datos vigentes al emitirse

#### Scenario: Pedido pagado desde Estados Unidos para Colombia

- **WHEN** se emite el comprobante de un pedido con pagador en EE.UU. y
  destinatario en Colombia
- **THEN** *Facturado a* lleva los datos y la dirección de EE.UU. y *Enviado a*
  el destinatario y la dirección colombiana

#### Scenario: Comprobante emitido antes de este cambio

- **WHEN** se vuelve a abrir un comprobante emitido cuando solo existía una
  dirección
- **THEN** se muestra tal como se congeló: una sola dirección, sin bloques
  vacíos
