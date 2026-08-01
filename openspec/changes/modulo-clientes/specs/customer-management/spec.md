## Purpose

Permite dar de alta y corregir clientes a mano, manteniendo la propiedad de la que depende todo lo demás: que un cliente sea **una sola fila**, identificada por su teléfono. Traza CLI_HU003 y CLI_HU004.

## ADDED Requirements

### Requirement: El teléfono es el identificador único del cliente

Dos clientes NO SHALL compartir el mismo teléfono. El correo también SHALL ser único cuando exista.

El teléfono SHALL normalizarse a formato internacional antes de guardarse y de comprobar duplicados.

**Invariante:** es la propiedad de la que cuelga todo el módulo. El checkout reconoce a un comprador que vuelve buscándolo por teléfono; si hubiera dos filas con el mismo número, su historial, sus métricas y su saldo de fidelización quedarían **repartidos entre dos clientes** y ninguno de los dos sería cierto. Y como no se puede eliminar, el duplicado sería permanente.

Normalizar antes de comparar no es cosmética: `3208270414`, `+57 320 827 0414` y `(320) 827-0414` son la misma persona, y sin normalización serían tres clientes.

#### Scenario: Alta con teléfono ya existente

- **WHEN** se intenta crear un cliente con un teléfono que ya pertenece a otro
- **THEN** la creación es rechazada indicando que ese teléfono ya está registrado, y no se crea ninguna fila

#### Scenario: Mismo número escrito de otra forma

- **WHEN** se intenta crear un cliente cuyo teléfono, ya normalizado, coincide con uno existente escrito en otro formato
- **THEN** se detecta como duplicado igualmente

#### Scenario: Alta con correo ya existente

- **WHEN** se intenta crear un cliente con un correo que ya pertenece a otro
- **THEN** la creación es rechazada indicando el conflicto

#### Scenario: Alta válida

- **WHEN** se crea un cliente con datos válidos y sin conflictos
- **THEN** queda registrado, aparece en el listado y su teléfono se guarda en formato internacional

### Requirement: Cambiar el teléfono es cambiar el identificador

La edición SHALL permitir modificar el teléfono. Si el nuevo teléfono ya pertenece a **otro** cliente, el cambio SHALL rechazarse.

Cambiar el teléfono NO SHALL alterar el historial del cliente: sus pedidos, métricas y saldo siguen siendo suyos.

**Invariante:** aquí no se ofrece fusionar dos clientes. Fusionar implica decidir qué pasa con dos historiales de compra, dos saldos y dos direcciones — es una operación con consecuencias sobre dinero, y merece su propia decisión de producto. Rechazar el cambio deja el problema visible; fusionar en silencio lo esconde.

#### Scenario: Cambio a un teléfono libre

- **WHEN** se cambia el teléfono de un cliente a uno que no usa nadie
- **THEN** el cambio se aplica y el cliente conserva todos sus pedidos y métricas

#### Scenario: Cambio a un teléfono ocupado

- **WHEN** se cambia el teléfono de un cliente al de otro cliente existente
- **THEN** el cambio es rechazado indicando con quién colisiona, y ningún dato se modifica

#### Scenario: Guardar sin cambiar el teléfono

- **WHEN** se edita un cliente sin tocar su teléfono
- **THEN** la comprobación de duplicados no lo señala contra sí mismo

### Requirement: Alta y edición desde panel lateral

Crear y editar SHALL ocurrir en paneles laterales sobre la vista de clientes, cuyo estado se refleje en la dirección de la página, igual que el resto del panel de administración.

Los errores de validación SHALL mostrarse **dentro del panel**, conservando lo que la persona ya escribió.

#### Scenario: Error de validación

- **WHEN** se envía el formulario con un teléfono duplicado
- **THEN** el panel sigue abierto, muestra el motivo y conserva los datos escritos

#### Scenario: Cierre tras guardar

- **WHEN** el guardado tiene éxito
- **THEN** el panel se cierra y el listado refleja el cambio sin recargar la página entera

### Requirement: Los clientes no se eliminan

NO SHALL existir ninguna forma de eliminar un cliente desde el módulo.

**Invariante:** el histórico es permanente porque alimenta el remarketing y la fidelización. Borrar un cliente se lleva por delante las compras que explican su saldo — y un saldo sin las compras que lo justifican es un pasivo que nadie puede auditar.

#### Scenario: Ausencia de la operación

- **WHEN** se revisan las operaciones que el módulo expone sobre un cliente
- **THEN** no existe ninguna que lo elimine, ni desde la interfaz ni desde las acciones del servidor

### Requirement: Toda escritura verifica permiso contra la base

Crear y editar SHALL verificar el permiso correspondiente **contra la base de datos** en cada invocación, no contra la sesión.

#### Scenario: Permiso revocado con sesión abierta

- **WHEN** se revoca el permiso de edición a un usuario y este, con su sesión aún viva, intenta guardar
- **THEN** la operación es rechazada

#### Scenario: Usuario con permiso de consulta pero no de edición

- **WHEN** un usuario que solo puede consultar intenta crear o editar
- **THEN** la operación es rechazada
