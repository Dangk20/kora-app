## MODIFIED Requirements

### Requirement: Clasificación por cuenta

El Módulo de clientes SHALL clasificar a cada persona como **Con cuenta** (tiene contraseña en la tienda) o **Sin cuenta**, derivado en cada consulta. SHALL mostrar los indicadores Total de registros, Clientes con cuenta y Clientes sin cuenta, que suman el total, y SHALL filtrar por esa clasificación. Comprar NO SHALL cambiar la clasificación.

#### Scenario: Registro sin compra
- **WHEN** alguien se registra en la tienda y no compra
- **THEN** aparece en el módulo como Con cuenta

#### Scenario: Cliente de caja
- **WHEN** la caja guarda a un cliente nuevo al cobrar
- **THEN** aparece como Sin cuenta, con origen Caja
