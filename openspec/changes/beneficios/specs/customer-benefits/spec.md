## ADDED Requirements

### Requirement: Otorgar beneficios

El administrador SHALL poder otorgar a un cliente un beneficio de tipo cashback de regalo (en pesos), descuento por categoría (1 % a 100 %) o producto de regalo. Todo beneficio SHALL vencer a los 30 días y usarse una sola vez. El cashback de regalo SHALL acreditarse al otorgarse como un lote de Kora Cashback que vence con el beneficio.

#### Scenario: Cashback de regalo
- **WHEN** el administrador otorga $10.000 de cashback de regalo
- **THEN** el saldo COP del cliente sube $10.000 y ese lote vence en 30 días

#### Scenario: Sin permiso
- **WHEN** un operador o cajero intenta otorgar un beneficio
- **THEN** la acción se rechaza

### Requirement: Ver beneficios

La ficha del cliente en el panel y la cuenta del comprador SHALL listar sus beneficios con estado Vigente, Usado o Vencido, derivado de la fecha de uso y de vencimiento; los vigentes primero.

#### Scenario: Beneficio vencido
- **WHEN** pasan 30 días sin usar un beneficio
- **THEN** aparece como Vencido y la caja no lo ofrece

### Requirement: Canje en caja

Al buscar al cliente en el cobro, la caja SHALL ofrecer sus descuentos y regalos vigentes. El descuento por categoría SHALL aplicarse sobre las líneas de esa categoría y sus subcategorías; el producto de regalo SHALL descontar una unidad del producto, que debe estar en el ticket. El canje SHALL ocurrir en la misma transacción de la venta, bloqueando el beneficio, y SHALL rechazarse si es de otro cliente, ya se usó o venció.

#### Scenario: Doble canje simultáneo
- **WHEN** dos cajas cobran a la vez con el mismo beneficio
- **THEN** exactamente una venta se registra

### Requirement: Kora Cashback en caja

Una venta de caja atada a un cliente SHALL acreditarle el 3 % de lo pagado con dinero (después del descuento del beneficio), en la misma transacción. Sin cliente, no SHALL acreditarse nada.

#### Scenario: Venta con descuento
- **WHEN** el cliente paga $132.000 después de un descuento de $8.000
- **THEN** recibe $3.960 de Kora Cashback
