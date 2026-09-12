## ADDED Requirements

### Requirement: El contenido se compone por bloques

Una campaña SHALL componerse como una lista ordenada de bloques de tipos
conocidos: título, texto, imagen, botón, productos, separador y espacio. El
operador SHALL poder añadir, editar, reordenar y quitar bloques. Una campaña
SHALL tener al menos un bloque con contenido para guardarse.

**Invariante:** el correo es UNO: cabecera de marca, saludo, bloques, pie legal.
Los bloques solo deciden lo que va en medio; la cabecera y el pie —que son lo
que la ley y la marca exigen— no se pueden quitar ni reordenar.

#### Scenario: Añadir y reordenar

- **WHEN** el operador añade un bloque de texto y lo sube por encima del título
- **THEN** el correo lo muestra en ese orden

#### Scenario: Campaña vacía

- **WHEN** intenta guardar sin ningún bloque con contenido
- **THEN** no se guarda y se le dice qué falta

#### Scenario: Campaña anterior a los bloques

- **WHEN** se abre a editar una campaña creada con campos fijos
- **THEN** se ve convertida a bloques equivalentes, sin perder nada

### Requirement: La vista previa es en vivo y es el mismo render del envío

Al editar, la vista previa SHALL actualizarse sola al cambiar cualquier bloque
o el asunto, **sin guardar**, y SHALL producirse por el mismo camino que el
envío. SHALL poder verse a ancho de escritorio y de móvil.

**Invariante:** lo que el operador ve es lo que recibe el destinatario. Una
vista previa con maqueta propia sería la primera cosa que se desincroniza y la
última que alguien nota.

#### Scenario: Cambio en un bloque

- **WHEN** el operador edita el texto de un bloque
- **THEN** la vista previa lo refleja sin pulsar guardar

#### Scenario: Mismo camino

- **WHEN** se compara el HTML de la vista previa con el del envío de esa campaña
- **THEN** son el mismo, salvo el saludo y el enlace de baja personalizados

### Requirement: El panel de Email marketing abre con tarjetas

La página principal del módulo SHALL mostrar, antes de la lista: los contactos
(suscritos y nuevos en los últimos 30 días), el consumo del plan, y las últimas
campañas con sus tasas de apertura y clic cuando el proveedor las reporta.

#### Scenario: Con métricas

- **WHEN** hay campañas enviadas con eventos del proveedor
- **THEN** la tarjeta de últimas campañas muestra su tasa de apertura y de clic

#### Scenario: Sin métricas

- **WHEN** no hay webhook configurado
- **THEN** las tasas se muestran como no disponibles, no en cero

### Requirement: La confirmación de envío es un modal propio

Enviar una campaña SHALL pedir confirmación en un modal del panel, no en un
diálogo del navegador. Si la audiencia no cabe en el cupo del día, el mismo
modal SHALL mostrar el aviso y pedir la segunda confirmación.

#### Scenario: Envío normal

- **WHEN** el operador pulsa Enviar
- **THEN** ve un modal con el número de destinatarios y los botones Cancelar y Enviar

#### Scenario: Cupo parcial

- **WHEN** la audiencia supera el cupo del día
- **THEN** el modal dice cuántos salen hoy y cuántos después, y pide confirmar de nuevo
