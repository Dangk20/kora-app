## Purpose

La caja de la tienda física: armar un ticket, cobrar sin pasarela, descontar el inventario que comparte con la web y entregar un recibo.

## ADDED Requirements

### Requirement: La caja vende del mismo stock que la web

Una venta POS SHALL descontar el stock con el motor de inventario (`applyStockMovement`, razón `VENTA_POS`, canal `POS`) dentro de la misma transacción que crea el pedido. La caja NO SHALL quedar bloqueada por el cupo online: el motor recorta el cupo. NO SHALL venderse más de lo que hay en el stock total.

**Invariante:** web y POS compiten por el mismo pool; ante la última unidad, exactamente una venta gana.

#### Scenario: Venta de mostrador
- **WHEN** el cajero cobra un ticket con stock suficiente
- **THEN** el stock total baja en las cantidades vendidas y queda un pedido `POS` entregado con su comprobante

#### Scenario: Última unidad en disputa
- **WHEN** una confirmación web y una venta POS compiten por la última unidad
- **THEN** exactamente una gana y la otra falla sin descontar nada

#### Scenario: Más de lo que hay
- **WHEN** el ticket pide más unidades que el stock total
- **THEN** la venta se rechaza diciendo qué producto falta y no se descuenta nada

### Requirement: El precio de caja es el de tienda en COP

Cada línea SHALL cobrarse a `priceCopStore`, resuelto en el servidor. El navegador NO SHALL fijar precios.

#### Scenario: Precio que llega del navegador
- **WHEN** la petición de cobro trae un precio
- **THEN** se ignora y se usa el precio de tienda guardado

### Requirement: Cobro manual con vueltas

El cobro SHALL registrar el método (efectivo, datáfono, transferencia —Nequi incluido—). Con efectivo SHALL pedir el monto recibido, que no puede ser menor que el total, y mostrar las vueltas.

#### Scenario: Efectivo
- **WHEN** el total es $34.000 y el cliente entrega $50.000
- **THEN** la venta se registra con vueltas de $16.000 y el recibo las muestra

#### Scenario: Efectivo insuficiente
- **WHEN** el monto recibido es menor que el total
- **THEN** no se cobra

### Requirement: Recibo con la estructura de un documento de venta

El recibo SHALL mostrar razón social, NIT y domicilio de KORA, el consecutivo del pedido, fecha y hora, cada línea con código, descripción, cantidad y valor, el total, el medio de pago y, en efectivo, recibido y vueltas. SHALL decir "Precios con IVA incluido" y "Este recibo no es factura electrónica". SHALL imprimirse en papel de 80 mm.

#### Scenario: Imprimir
- **WHEN** termina el cobro
- **THEN** la caja abre el recibo listo para imprimir y ofrece "Nueva venta"

### Requirement: Turno de caja con apertura, salidas y cierre

La caja SHALL vender solo con un **turno abierto**. La apertura SHALL pedir la base de efectivo, proponiendo la que dejó el último cierre. Debe existir a lo sumo un turno abierto por caja. Durante el turno SHALL poder registrarse **salidas de dinero** con monto y motivo. El cierre SHALL mostrar las ventas del turno por método de pago, las salidas y el efectivo que debe haber en el cajón (base + ventas en efectivo − salidas), congelar ese resumen y preguntar si se deja base para el día siguiente.

#### Scenario: Caja cerrada
- **WHEN** no hay turno abierto
- **THEN** la caja muestra solo la pregunta de apertura y el servidor rechaza ventas y salidas

#### Scenario: Cierre con salidas
- **WHEN** el turno abrió con $100.000, vendió $34.000 en efectivo y registró una salida de $12.000
- **THEN** el cierre dice que debe haber $122.000 en el cajón

#### Scenario: Base para el día siguiente
- **WHEN** al cerrar se deja una base de $80.000
- **THEN** la siguiente apertura la propone

