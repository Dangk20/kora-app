## Purpose

El documento de venta que KORA emite por cada pedido confirmado: qué dice, en
qué momento queda congelado, quién puede verlo y en qué se diferencia de la
factura electrónica que llegará después.

## ADDED Requirements

### Requirement: Un pedido confirmado emite exactamente un comprobante

Al confirmar un pedido, el sistema SHALL emitir **un** comprobante de pedido, y
SHALL emitirlo **dentro de la misma transacción** que cambia el estado. Un
pedido que nunca se confirma NO SHALL tener comprobante. Confirmar dos veces NO
SHALL producir dos comprobantes.

**Invariante:** el comprobante es la constancia de una venta, y una venta que se
deshace no debe dejar constancia. Emitirlo fuera de la transacción abriría la
ventana en que existe un comprobante de un pedido que no llegó a confirmarse.

#### Scenario: Se confirma un pedido

- **WHEN** el operador confirma un pedido pendiente
- **THEN** queda emitido un comprobante con la fecha y hora de esa confirmación

#### Scenario: Se confirma dos veces

- **WHEN** la confirmación se ejecuta de nuevo sobre un pedido ya confirmado
- **THEN** el comprobante sigue siendo el mismo, con su fecha original

#### Scenario: La confirmación falla

- **WHEN** la transacción de confirmación se revierte por cualquier motivo
- **THEN** no queda ningún comprobante emitido

#### Scenario: Un pedido cancelado o expirado

- **WHEN** un pedido termina cancelado o expirado sin haber sido confirmado
- **THEN** no existe comprobante para ese pedido

### Requirement: El comprobante queda congelado en el momento de emitirse

El comprobante SHALL guardar su propio contenido —datos del comerciante, datos
del comprador, dirección de entrega, líneas con cantidad y precio unitario,
descuentos, cashback aplicado y totales— tal como estaban al emitirlo. Cambios
posteriores en el catálogo, en el cliente, en su libreta de direcciones o en los
datos del comerciante NO SHALL alterar un comprobante ya emitido.

**Invariante:** es la misma razón por la que el pedido lleva su propio snapshot,
llevada un paso más allá: el pedido congela lo que se cobró; el comprobante
congela además **quién lo cobró y a nombre de quién**, que es lo que un
documento de respaldo tiene que sostener años después.

#### Scenario: El producto cambia de precio o de nombre

- **WHEN** después de emitido el comprobante el producto cambia de precio, de
  nombre, o se archiva
- **THEN** el comprobante sigue mostrando el nombre y el precio que tenía la
  compra

#### Scenario: El comprador cambia su dirección

- **WHEN** el comprador edita o borra la dirección con la que compró
- **THEN** el comprobante conserva la dirección a la que se envió

#### Scenario: Cambian los datos del comerciante

- **WHEN** cambia la razón social, el NIT o el domicilio del comerciante
- **THEN** los comprobantes ya emitidos conservan los datos vigentes al emitirse

### Requirement: El comprobante declara que no es una factura electrónica

El comprobante SHALL titularse **"Comprobante de pedido"** y SHALL incluir, de
forma legible, que no constituye factura electrónica de venta.

**Invariante:** cuando exista la factura electrónica habrá dos documentos por la
misma compra, con numeraciones distintas. Si ambos se llaman "factura", el
comprador tiene dos facturas de un solo pago y ninguna forma de saber cuál vale.

#### Scenario: Se lee un comprobante

- **WHEN** alguien abre el comprobante de un pedido
- **THEN** el documento se identifica como comprobante de pedido y advierte que
  no es una factura electrónica de venta

### Requirement: El comprobante no desglosa impuestos que el sistema no conoce

Mientras el sistema no tenga datos tributarios cargados, el comprobante NO SHALL
mostrar base gravable, tarifa ni valor de IVA. SHALL mostrar únicamente los
importes que realmente conoce: subtotal, descuentos, cashback aplicado y total.

**Invariante:** un desglose calculado a partir de una tarifa supuesta no es un
dato incompleto, es un dato falso con apariencia de dato — y a diferencia de un
campo vacío, nadie lo revisa.

#### Scenario: Comprobante sin información tributaria cargada

- **WHEN** se emite un comprobante y el sistema no tiene tarifas de impuesto
- **THEN** el documento presenta los totales sin ninguna línea de IVA

### Requirement: El comprobante se numera con el número del pedido

El comprobante SHALL identificarse con el mismo número que su pedido. NO SHALL
usar una numeración propia.

**Invariante:** una numeración paralela solo tendría sentido si fuera fiscal y
sin huecos, y la fiscal la asignará la DIAN con su propio prefijo cuando exista
la factura electrónica. Mientras tanto, dos números para una misma compra solo
crean la pregunta de por cuál buscar.

#### Scenario: Se busca un comprobante

- **WHEN** alguien tiene el número de un pedido
- **THEN** ese mismo número identifica su comprobante

### Requirement: El comprobante llega al comprador sin que tenga que pedirlo

El comprobante SHALL viajar **adjunto en formato PDF** en el correo de pedido
confirmado que recibe el comprador.

**Invariante:** el pago ocurre fuera de la plataforma, por WhatsApp. El correo
de confirmación es el único momento garantizado en que el comprador y su
constancia coinciden.

#### Scenario: Se confirma el pedido de un comprador con correo

- **WHEN** se envía el correo de pedido confirmado
- **THEN** lleva adjunto el PDF del comprobante

#### Scenario: El PDF no se puede generar

- **WHEN** falla la generación del PDF al momento de enviar
- **THEN** el correo de confirmación se envía igualmente, sin adjunto, y el
  fallo queda registrado

**Invariante del escenario anterior:** perder el aviso de que un pago fue
confirmado, por culpa de un adjunto, es cambiar un problema pequeño por uno
grande — la misma razón por la que crear un pedido nunca depende de que salga
un correo.

### Requirement: El comprobante se puede ver y descargar después

El comprobante SHALL poder consultarse y descargarse como PDF desde el detalle
del pedido en el panel, y desde el detalle del pedido en la cuenta del
comprador. El contenido SHALL salir del comprobante congelado, nunca de un
cálculo nuevo.

#### Scenario: El operador consulta un pedido confirmado

- **WHEN** el operador abre en el panel un pedido confirmado
- **THEN** puede ver y descargar su comprobante

#### Scenario: El comprador perdió el correo

- **WHEN** el comprador con sesión abre su pedido confirmado en su cuenta
- **THEN** puede descargar el mismo comprobante que se le envió

#### Scenario: Un comprador intenta ver el comprobante de otro

- **WHEN** se pide el comprobante de un pedido que no pertenece a quien lo pide
- **THEN** no se entrega el documento

#### Scenario: Pedido sin comprobante

- **WHEN** se abre un pedido pendiente, cancelado o expirado
- **THEN** no se ofrece ningún comprobante para descargar

### Requirement: La factura electrónica se anuncia, no se esconde

La interfaz SHALL mostrar la factura electrónica como una opción **presente y
desactivada**, marcada como próxima, e indicando qué falta para habilitarla. NO
SHALL ocultarse.

**Invariante:** es el mismo criterio que Email marketing. Un botón ausente se
lee como funcionalidad no contemplada; un botón desactivado que explica qué
falta le dice al cliente exactamente qué insumo depende de él.

#### Scenario: Se abre un pedido confirmado

- **WHEN** el operador ve las acciones de documentos de un pedido confirmado
- **THEN** ve la factura electrónica listada, desactivada y marcada como próxima

#### Scenario: Se intenta usar

- **WHEN** se intenta activar la factura electrónica
- **THEN** no se emite nada y se explica qué falta para habilitarla
