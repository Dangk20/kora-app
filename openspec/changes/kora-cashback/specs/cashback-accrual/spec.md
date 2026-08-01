## Purpose

Convierte una compra confirmada en cashback para el cliente, con la garantía de que se acredita exactamente una vez y sobre la base correcta.

## ADDED Requirements

### Requirement: El cashback se calcula sobre el dinero realmente pagado

El importe SHALL ser el **3 %** del valor pagado **con dinero**: el total del pedido después de descuentos, cupones y **del propio cashback aplicado**.

**Invariante:** es la regla que el cliente precisó el 1 de agosto y su motivo es la sostenibilidad del programa. Calcular sobre el total incluyendo la parte pagada con saldo crea un ciclo en el que el beneficio se recompensa a sí mismo: el cliente gasta cashback, eso le genera más cashback, y el programa se financia solo hacia abajo hasta que alguien lo nota en la caja.

#### Scenario: Compra sin descuentos

- **WHEN** se confirma un pedido de $40.000 sin cupones ni cashback aplicado
- **THEN** se acreditan $1.200

#### Scenario: Compra con cupón

- **WHEN** se confirma un pedido cuyo total ya tiene un cupón descontado
- **THEN** el cashback se calcula sobre el total **después** del cupón, no sobre el precio de lista

#### Scenario: Compra pagada en parte con cashback

- **WHEN** un cliente paga $80.000 con dinero y $20.000 con su saldo
- **THEN** se acreditan $2.400 — el 3 % de $80.000, no de $100.000

#### Scenario: Compra pagada íntegramente con cashback

- **WHEN** el cliente cubre el total con su saldo y no paga nada con dinero
- **THEN** **no se acredita cashback**, y la interfaz lo explica en lugar de mostrar un cero sin motivo

### Requirement: El redondeo está escrito y va hacia abajo

El importe SHALL truncarse hacia abajo: al **peso** en pesos colombianos y al **centavo** en dólares.

**Invariante:** el 3 % de $33.333 son $999,99 y en pesos no se manejan centavos. Sin una regla escrita, cada punto del código redondearía a su manera y los saldos dejarían de cuadrar por céntimos que nadie sabe de dónde salen. Hacia abajo porque el programa lo paga el negocio, y es la misma regla que ya rige los cupones.

#### Scenario: Importe con decimales en pesos

- **WHEN** el 3 % de una compra en pesos da un valor con decimales
- **THEN** se acredita el peso entero inferior

#### Scenario: Importe con decimales en dólares

- **WHEN** el 3 % de una compra en dólares da más de dos decimales
- **THEN** se acredita truncado al centavo

### Requirement: Acreditar dos veces el mismo pedido es imposible

La acreditación SHALL ser **idempotente**: procesar el mismo pedido más de una vez SHALL dejar el mismo saldo que procesarlo una vez.

**Invariante:** la acreditación ocurre desde la bandeja de salida, cuya entrega es **al menos una vez** — un evento puede llegar dos veces porque el proceso murió tras aplicar el efecto o porque otro manejador falló y se reintentó el evento completo. Aquí lo que se duplicaría es **dinero**, y nadie reclama que le hayan dado de más: el error no se reporta, se acumula.

La comprobación SHALL hacerse sobre el rastro en el libro —¿ya existe un lote de este pedido?— y no sobre una marca aparte que pueda desincronizarse.

#### Scenario: El mismo evento llega dos veces

- **WHEN** el evento de confirmación de un pedido se entrega dos veces
- **THEN** existe un solo lote de cashback para ese pedido y el saldo es el mismo

#### Scenario: Fallo después de acreditar

- **WHEN** el proceso muere tras crear el lote y antes de marcar el evento como procesado
- **THEN** el reintento no crea un segundo lote

#### Scenario: Confirmación repetida del mismo pedido

- **WHEN** se confirma un pedido que ya estaba confirmado
- **THEN** no se acredita cashback de nuevo

### Requirement: El cashback se acredita en la moneda del pedido

El lote SHALL crearse en la **moneda del pedido**, sin convertir.

#### Scenario: Pedido en dólares

- **WHEN** se confirma un pedido en dólares
- **THEN** el cashback entra al saldo en dólares del cliente

#### Scenario: Cliente con compras en ambas monedas

- **WHEN** el mismo cliente confirma pedidos en las dos monedas
- **THEN** cada uno alimenta su propia bolsa

### Requirement: Un pedido sin cliente identificado no acredita

Si un pedido confirmado no tiene cliente asociado, NO SHALL acreditarse cashback, y el hecho SHALL quedar registrado en lugar de fallar en silencio.

**Invariante:** el cashback pertenece a alguien. Un lote sin dueño es dinero que no se puede reclamar ni auditar. Y como todo pedido de la tienda crea o reconoce a su cliente, encontrarse uno sin él es una señal de que algo va mal aguas arriba: hay que verlo, no ignorarlo.

#### Scenario: Pedido sin cliente

- **WHEN** se confirma un pedido que no tiene cliente asociado
- **THEN** no se acredita nada y queda constancia del motivo

### Requirement: El vencimiento se ejecuta solo

El sistema SHALL vencer automáticamente los lotes que cumplen 12 meses, sin intervención.

#### Scenario: Ejecución periódica

- **WHEN** existen lotes que ya cumplieron 12 meses
- **THEN** el trabajo programado los vence y deja constancia de cuántos y por qué importe

#### Scenario: Sin lotes vencidos

- **WHEN** ningún lote ha cumplido 12 meses
- **THEN** el trabajo termina con éxito informando que no había nada que vencer
