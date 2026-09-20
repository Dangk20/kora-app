## MODIFIED Requirements

### Requirement: Elegir la dirección al comprar

El sistema SHALL ofrecer al comprador con sesión sus direcciones guardadas en el checkout **para el bloque de envío**, y SHALL llenar los campos de entrega con la elegida. Elegir una dirección NO SHALL impedir escribir otra distinta. La libreta es de direcciones de **envío en Colombia**: una dirección guardada fuera de Colombia NO SHALL poder elegirse como destino.

#### Scenario: Compra con dirección guardada
- **WHEN** un comprador con al menos una dirección en Colombia entra al checkout y la entrega no es a la misma dirección del pagador
- **THEN** aparece seleccionada la predeterminada y los campos de envío ya vienen llenos con ella

#### Scenario: Comprar a otra dirección
- **WHEN** elige escribir una dirección distinta
- **THEN** los campos de envío quedan editables y vacíos para llenarlos
- **AND** puede pedir que esa dirección se guarde en su libreta

#### Scenario: Dirección guardada fuera de Colombia
- **WHEN** la libreta tiene una dirección con país distinto de Colombia, guardada antes de este cambio
- **THEN** se muestra como incompleta, no se puede elegir como destino y el checkout pide los campos de envío

#### Scenario: Comprador sin direcciones o sin sesión
- **WHEN** no hay sesión, o el comprador no tiene ninguna dirección guardada
- **THEN** el checkout se comporta como hoy: formulario vacío, sin selector

#### Scenario: La libreta no toca la facturación
- **WHEN** el comprador elige una dirección de su libreta
- **THEN** cambia solo el bloque de envío; los datos y la dirección de quien paga no se alteran
