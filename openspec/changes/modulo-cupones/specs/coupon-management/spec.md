## Purpose

Permite al negocio lanzar y controlar promociones sin pasar por desarrollo: qué código, cuánto descuenta, hasta cuándo, cuántas veces y sobre qué productos. Traza CUP_HU001, CUP_HU002 y CUP_HU003.

## ADDED Requirements

### Requirement: El estado del cupón es derivado, con una precedencia fija

Un cupón NO SHALL tener un campo de estado editable. Su estado SHALL calcularse en este orden:

1. **Inactivo** — está pausado manualmente
2. **Vencido** — su fecha de vencimiento ya pasó
3. **Agotado** — sus usos alcanzaron el máximo total
4. **Activo** — todo lo demás

**Invariante:** el estado que muestra el panel y el que evalúa el checkout SHALL ser el mismo cálculo. Si fueran dos, un cupón podría verse Activo en el panel y ser rechazado al comprador — y nadie sabría cuál de las dos pantallas miente.

#### Scenario: Pausado y vencido a la vez

- **WHEN** un cupón está pausado y además su fecha ya pasó
- **THEN** se muestra como Inactivo, porque la pausa tiene precedencia

#### Scenario: Agotado antes de vencer

- **WHEN** un cupón alcanza su máximo de usos y todavía está en fecha
- **THEN** se muestra como Agotado

#### Scenario: Sin vencimiento ni máximo

- **WHEN** un cupón no tiene fecha de vencimiento ni máximo de usos y está activo
- **THEN** se muestra como Activo indefinidamente

#### Scenario: Coherencia con el canje

- **WHEN** un cupón figura como Vencido, Agotado o Inactivo en el panel
- **THEN** el checkout lo rechaza

### Requirement: El código es único e inmutable

El código SHALL ser único, normalizado a mayúsculas, de 3 a 20 caracteres sin espacios. Una vez creado el cupón, el código NO SHALL poder modificarse.

**Invariante:** el código es lo que el comprador escribe y lo que queda registrado en los pedidos. Cambiarlo dejaría pedidos históricos apuntando a un código que ya no significa lo mismo — y campañas impresas o enviadas por correo apuntando a nada.

#### Scenario: Código duplicado

- **WHEN** se intenta crear un cupón con un código que ya existe
- **THEN** se rechaza indicando que ese código ya está en uso, sin crear nada

#### Scenario: Código escrito en minúsculas

- **WHEN** se crea un cupón escribiendo el código en minúsculas
- **THEN** se guarda en mayúsculas, y crear otro con las mismas letras en otra caja se detecta como duplicado

#### Scenario: Intento de editar el código

- **WHEN** se edita un cupón existente
- **THEN** el código no puede modificarse

### Requirement: Tipos de descuento y su valor

Un cupón SHALL ser de uno de tres tipos:

| Tipo | Valor |
|---|---|
| **Porcentaje** | Entre 1 y 100 |
| **Monto fijo** | Aplica a pesos, a dólares o **a ambas**. Con "ambas" lleva un valor por divisa |
| **Producto gratis** | Una variante concreta del catálogo, que entra al pedido con precio cero |

Todo valor de descuento SHALL ser mayor que cero.

**Invariante:** con "ambas monedas" se guardan **dos valores independientes**, uno por divisa. No se convierte de uno a otro: no existe tasa de cambio en KORA y es deliberado. Un cupón de "$10.000" no es un cupón de "10 dólares".

#### Scenario: Monto fijo en las dos monedas

- **WHEN** se crea un cupón de monto fijo aplicable a ambas monedas
- **THEN** se exige un valor para cada divisa y ambos se guardan por separado

#### Scenario: Monto fijo en una sola moneda

- **WHEN** se crea un cupón de monto fijo aplicable solo a pesos
- **THEN** se guarda únicamente ese valor, y el cupón no aplica a pedidos en dólares

#### Scenario: Porcentaje fuera de rango

- **WHEN** se intenta guardar un porcentaje de 0 o mayor que 100
- **THEN** se rechaza

#### Scenario: Producto gratis sin variante

- **WHEN** se intenta guardar un cupón de producto gratis sin elegir la variante
- **THEN** se rechaza

### Requirement: Validez, límites y reglas de comportamiento

Un cupón SHALL poder definir: fecha desde la que vale, fecha en que vence, máximo de usos totales, máximo por cliente, si está activo, si es **solo para la primera compra** y si **aplica a productos ya en oferta**.

La fecha de vencimiento NO SHALL ser anterior a la de inicio. El máximo de usos totales NO SHALL fijarse por debajo de los usos ya consumidos.

**Invariante:** bajar el máximo por debajo de lo ya usado dejaría el cupón en un estado imposible —agotado con un cupo negativo— y volvería incoherentes los contadores del panel.

#### Scenario: Vencimiento anterior al inicio

- **WHEN** se intenta guardar una fecha de vencimiento anterior a la de inicio
- **THEN** se rechaza

#### Scenario: Reducir el cupo por debajo de lo usado

- **WHEN** un cupón lleva 12 usos y se intenta fijar su máximo en 10
- **THEN** se rechaza indicando cuántos usos tiene

#### Scenario: Campos de validez vacíos

- **WHEN** se guarda un cupón sin fecha de inicio, sin vencimiento y sin máximo de usos
- **THEN** vale desde ya, sin vencimiento y con usos ilimitados

### Requirement: Alcance sobre el catálogo

Un cupón SHALL aplicar a **todo el catálogo**, a **categorías concretas** o a **productos concretos**.

El descuento SHALL calcularse únicamente sobre los ítems del carrito que caen dentro de ese alcance.

#### Scenario: Alcance por categoría

- **WHEN** un cupón aplica a una categoría y el carrito mezcla productos de esa categoría y de otras
- **THEN** el descuento se calcula solo sobre los de esa categoría

#### Scenario: Alcance a todo el catálogo

- **WHEN** un cupón aplica a todo el catálogo
- **THEN** el descuento se calcula sobre todos los ítems del carrito

### Requirement: Los cupones se pausan, no se eliminan

NO SHALL existir forma de eliminar un cupón. Pausarlo SHALL ser la única manera de sacarlo de circulación, y SHALL poder hacerse desde el listado en un clic.

Pausar un cupón NO SHALL afectar a los pedidos ya creados con él.

**Invariante:** los pedidos históricos referencian el cupón. Borrarlo rompería su trazabilidad — y con ella la respuesta a "¿cuánto nos costó esa campaña?", que es la única razón por la que un cupón se registra en lugar de descontarse a mano.

#### Scenario: Pausar desde el listado

- **WHEN** se pausa un cupón desde el listado
- **THEN** pasa a Inactivo de inmediato y el checkout empieza a rechazarlo

#### Scenario: Un pedido creado con un cupón que luego se pausa

- **WHEN** se pausa un cupón que ya tenía pedidos creados
- **THEN** esos pedidos conservan su descuento y pueden confirmarse con normalidad

#### Scenario: Ausencia de eliminación

- **WHEN** se revisan las operaciones que el módulo expone
- **THEN** no existe ninguna que elimine un cupón

### Requirement: Editar un cupón con usos avisa de sus consecuencias

Al editar tipo, valor o alcance de un cupón que ya tiene usos, SHALL advertirse que los cambios afectan solo a canjes futuros y que los pedidos existentes conservan su descuento original.

#### Scenario: Editar un cupón usado

- **WHEN** se abre para editar un cupón con usos mayores que cero
- **THEN** se advierte cuántos usos tiene y que los pedidos existentes no cambian

### Requirement: Cada operación exige su permiso, verificado contra la base

Consultar, crear y editar cupones SHALL exigir sus permisos respectivos, verificados **contra la base de datos** en cada acción protegida.

#### Scenario: Usuario sin permiso de gestión

- **WHEN** un usuario sin el permiso de edición intenta pausar un cupón
- **THEN** la operación es rechazada

#### Scenario: Permiso revocado con sesión viva

- **WHEN** se revoca el permiso a un usuario con sesión abierta y este intenta guardar
- **THEN** la operación es rechazada, porque se verifica contra la base y no contra la sesión
