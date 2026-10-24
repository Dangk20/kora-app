## Purpose

Anuncio de un evento de la marca en la tienda pública: cuándo aparece, a quién y hasta cuándo.

## ADDED Requirements

### Requirement: El anuncio de la gran apertura aparece una vez por visitante

La tienda pública SHALL mostrar el modal de la gran apertura la primera vez que un visitante entra a una página de la tienda, y NO SHALL volver a mostrarlo en ese navegador después de cerrarlo.

#### Scenario: Primera visita
- **WHEN** un visitante entra por primera vez a korashopp.com antes o durante el 7 nov 2026
- **THEN** ve el modal con la fecha, la dirección y el botón «Cómo llegar»

#### Scenario: Ya lo cerró
- **WHEN** el visitante cerró el modal y vuelve a otra página o recarga
- **THEN** el modal no aparece

### Requirement: El anuncio caduca después del evento

El modal NO SHALL mostrarse después del 7 de noviembre de 2026 (hora de Colombia), sin necesidad de un despliegue.

#### Scenario: Visita el 8 de noviembre
- **WHEN** un visitante nuevo entra el 8 nov 2026
- **THEN** no ve el modal

### Requirement: «Cómo llegar» lleva a la tienda física

El botón «Cómo llegar» SHALL abrir Google Maps en una pestaña nueva con la dirección Calle 25 Sur # 32-23, Neiva, Huila.

#### Scenario: Toca «Cómo llegar»
- **WHEN** el visitante toca el botón
- **THEN** se abre Google Maps con la dirección y el modal queda cerrado
