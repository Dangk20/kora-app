## MODIFIED Requirements

### Requirement: Solo recibe campañas quien está suscrito y tiene un correo utilizable

La audiencia de una campaña SHALL excluir, **sin excepción**, a quien se dio de baja y a quien tiene el correo marcado como no utilizable.

La exclusión SHALL aplicarse **dos veces**: al construir la audiencia y otra vez **al enviar cada lote**.

**Invariante:** entre que se arma una audiencia y que sale el último lote pueden pasar horas. Alguien que se da de baja en ese intervalo y aun así recibe el correo tiene razón en quejarse, y esa queja va directa contra la reputación del dominio. Comprobarlo dos veces cuesta una consulta por lote; no comprobarlo cuesta el canal.

**Añadido con los correos transaccionales:** los dos motivos de exclusión dejan de ser intercambiables. La **baja de marketing** significa *"no me mandes promociones"* y frena solo las campañas. La **dirección no utilizable** significa *"aquí no vive nadie"* y frena **todo**, incluidos los correos del pedido.

Confundirlos rompe en las dos direcciones: tratar toda supresión como baja le niega su comprobante a quien solo rechazó publicidad, y tratar toda baja como dirección muerta nos deja escribiendo a buzones que no existen — que es lo que hunde la reputación del dominio y hace que deje de llegar el correo de todos los demás.

#### Scenario: Baja durante el envío

- **WHEN** un destinatario se da de baja con la campaña a medio enviar
- **THEN** no recibe el correo, aunque estuviera en la lista congelada

#### Scenario: Correo marcado como no utilizable

- **WHEN** un cliente tiene el correo marcado tras un rebote duro
- **THEN** queda fuera de toda campaña futura

#### Scenario: Cliente sin correo

- **WHEN** un cliente no tiene correo registrado
- **THEN** nunca entra en una audiencia

#### Scenario: Dado de baja que hace un pedido

- **WHEN** alguien dado de baja de promociones compra
- **THEN** sigue fuera de toda campaña, pero recibe los correos de su pedido

#### Scenario: Dirección no utilizable que hace un pedido

- **WHEN** compra alguien cuya dirección quedó marcada como no utilizable
- **THEN** no recibe nada, ni campaña ni correo del pedido
