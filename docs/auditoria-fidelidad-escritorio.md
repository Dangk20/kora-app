# Auditoría de fidelidad — escritorio

> **Estado al 7 ago 2026, tras el change `correcciones-fidelidad-escritorio`:**
> ✅ Corregidos **D1**, **D2**, **F4** y **F5**. Fijados por prueba en `tests/fidelidad.test.ts`.
> 🕓 Abiertos: **F1** (filtros, S6), **F2** (banner) y **F3** (fila del header) — necesitan decisión de producto; **F6**, **F7** y **F8** — planificados.

**Fecha:** 7 ago 2026 · **Método:** recorrido pantalla por pantalla a 1440 px, comparando la aplicación en ejecución contra el prototipo aprobado `../../design-handoff/Kora.dc.html` servido en local.

**Alcance:** tienda pública y panel de administración, en escritorio. El móvil va aparte (change `tienda-movil`).

---

## Cómo leer esto

Las diferencias no son todas defectos. Se separan en tres:

| | Qué significa |
|---|---|
| 🔴 **Defecto** | El sistema hace algo peor de lo que ya sabe hacer, o contradice una regla escrita del proyecto. Se corrige. |
| 🟡 **Diferencia** | Se apartó del prototipo. Puede ser correcto o no: **necesita decisión**. |
| ⚪ **Deliberado** | Se apartó a propósito, con la razón registrada. No se toca sin revertir esa decisión. |

Un prototipo de junio no es la especificación de agosto: entre medias se decidió cambiar la paleta, quitar promesas comerciales que el negocio no sostiene, y se construyeron seis módulos que el prototipo no contempla. Tratar cada diferencia como un error obligaría a revertir decisiones buenas.

---

## 🔴 Defectos

### D1 · El dashboard muestra el estado del pedido en inglés y en crudo — ✅ CORREGIDO

**Dónde:** `src/app/admin/page.tsx:249` — tabla *Últimos pedidos*.

La columna **ESTADO** imprime `{o.status}`, es decir el enum de la base: **`CONFIRMED`**, **`PREPARING`**. En un panel en español que el cliente usa a diario.

Lo llamativo es que **el sistema ya sabe hacerlo bien**: `STATUS_LABEL` existe en `src/modules/orders/status.ts:16` y lo usan `pedidos/page.tsx:158`, `pedidos/[id]/page.tsx:82` y `order-actions.tsx:88`. La pantalla de Pedidos muestra *"Confirmado"* y *"En preparación"* con su badge de color, correctamente. Solo el dashboard se saltó el formateador.

El prototipo especifica `statusStyle(status)` → badge de color por estado. Aquí no hay badge ni color: es texto gris.

**Impacto:** es la primera pantalla que ve el operador al entrar. Corregir es una línea.

### D2 · Las cards de producto llevan botón, contra la regla escrita del proyecto — ✅ CORREGIDO

**Dónde:** `src/modules/storefront/product-card.tsx:105-108`.

`CLAUDE.md:78` dice, textualmente:

> *"Las cards del catálogo **no llevan botón**: la compra se decide en la ficha."*

Y las cards llevan botón: **"Agregar"** si el producto es simple, **"Ver opciones"** si tiene variantes. Aparece en el catálogo y en *Productos destacados* del home.

No es un detalle de gusto. El diseño móvil nuevo (7 ago) evalúa exactamente esta decisión, elige la card sin botón, y da la razón:

> *"En KORA el pedido termina en WhatsApp y muchos productos tienen variantes: un 'agregar' desde la card genera carritos con la variante equivocada y fricción al corregirla."*

**Aquí hay que decidir, no solo corregir.** El prototipo de junio **sí** tiene botón en las cards del home; el diseño móvil de agosto dice que no. Las dos referencias son legítimas y se contradicen. Lo que no puede quedarse es el estado actual: una regla escrita en `CLAUDE.md` que el código incumple, porque a partir de ahí ninguna de las dos es fiable.

**Recomendación:** quitar el botón y alinear con el diseño nuevo, que además razona el caso concreto de KORA. Si se prefiere conservarlo, corregir `CLAUDE.md`.

**Decisión de Daniel (7 ago): se quita.** Toda la tarjeta pasa a ser el enlace a la ficha. Efecto lateral que apareció al hacerlo: la tarjeta dejó de necesitar el contexto del carrito, así que el listado ya no instancia un componente cliente por producto.

---

## 🟡 Diferencias que necesitan decisión

### F1 · Faltan filtros del catálogo

El prototipo tiene, en la barra lateral: subcategoría, **precio (slider)**, **marca (casillas con conteo)**, **descuento (chips 10/20/30 %+)**, **interruptor "Solo en oferta"** y botón **"Limpiar"**.

Hoy solo hay la lista de categorías con su conteo.

Ya estaba declarado como pendiente de S6 en la bitácora, así que no es una sorpresa — pero es la diferencia más visible del catálogo y conviene decidir si entra antes del go-live.

### F2 · El banner de portada es otra cosa

El prototipo divide el banner en tres (`1.4fr .85fr 1fr`): **card de producto destacado** (marca, badge de descuento, nombre, especificación, precio con tachado y CTA), **promo oscura diseñada** y **Top Categorías**.

Hoy las dos primeras zonas son **imágenes completas** que el operador sube desde Vitrina, sin texto ni precio superpuestos.

Es una diferencia estructural, no cosmética, y tiene un argumento a favor: el operador cambia la portada sin tocar código. Pero pierde el precio y el CTA sobre el producto destacado. **Decisión de producto.**

### F3 · La segunda fila del header cambió de contenido

Prototipo: *Ofertas · Novedades · Más vendidos · Marcas · Ayuda*.
Hoy: las categorías reales del catálogo.

Se cambió porque **ninguna de esas cinco páginas existe** en el alcance, y enlazar a páginas inexistentes es peor que no enlazarlas. Pero el resultado es que las categorías aparecen dos veces en la portada (header y Top Categorías), y se perdió el acceso directo a ofertas.

### F4 · La ficha perdió el bloque de garantías — ✅ CORREGIDO

El prototipo pone, bajo los botones de compra, **tres garantías con icono**. Hoy hay una línea de texto: *"Completas tus datos y finalizas el pedido por WhatsApp."*

El home **sí** tiene la fila de garantías (con las tres que el negocio sostiene). Falta replicarlas en la ficha, que es donde se decide la compra.

### F5 · Orden de los botones de compra invertido — ✅ CORREGIDO

Prototipo: *Agregar al carrito* (contorno) y luego *Comprar ahora* (gradiente).
Hoy: *Comprar ahora* arriba, *Agregar al carrito* debajo.

Trivial de cambiar. Se anota porque "tal cual" incluye el orden.

### F6 · "Categorías" no está en el menú lateral del panel

El prototipo lo tiene como ítem propio del nav. Hoy vive dentro de Productos (`/admin/catalogo/categorias`).

### F7 · La tabla de Pedidos no tiene columna de canal

El prototipo muestra un badge **Online** (azul) / **POS** (morado). Hoy no hay columna de canal en el listado — sí en el dashboard.

Hoy todos los pedidos son Online porque el POS es de S9, así que la columna no aporta **todavía**. Se anota para no descubrirlo al construir el POS.

### F8 · El acento tipográfico del titular

El prototipo destaca una palabra del titular en fuente de acento itálica (*"encendidas"*, *"solo lugar"*). El manual de marca sustituye Playfair por **Allura**, pero el **patrón** —una palabra destacada en la fuente de acento— debería conservarse. Verificar si se conservó o se perdió al cambiar de fuente.

---

## ⚪ Diferencias deliberadas — no tocar sin revertir la decisión

1. **Paleta y tipografía.** El gradiente oficial (`#FF6A00 → #7A3DB8`) y Manrope/Allura **reemplazan** al naranja fuego y Poppins/Inter/Playfair del prototipo. Acuerdo del 18 jul, tras feedback de Daniel. Regla vigente: *layout y patrones del prototipo; color y tipografía del manual*.
2. **Sin estrellas ni valoraciones.** No hay sistema de reseñas en el alcance. Pintar estrellas fijas sería inventar una valoración.
3. **Sin favoritos** (corazón en las cards). Fuera de alcance.
4. **Sin cuotas, sin envío gratis, sin compra protegida, sin devoluciones a 7 días.** El prototipo las promete y el negocio no las sostiene. Registrado en `../../notas-tecnicas-privado.md` §Tienda pública.
5. **Selector de país → selector de dos monedas.** El alcance real son COP y USD con precio propio por divisa, sin conversión por tasa. El prototipo convierte a 4100, que es justo lo que aquí no se hace.
6. **Sin pasarela de pago.** Checkout multipaso del prototipo → pedido y WhatsApp. Decisión del cliente.
7. **Sin IVA en el POS ni factura DIAN.** POS es S9.
8. **Módulos que el prototipo no contempla** y por tanto no tienen contra qué compararse: Vitrina, Clientes, Cupones, Ventas, Email marketing, Usuarios/RBAC, cuenta del comprador, Kora Cashback y las páginas legales.

---

## Qué queda abierto

**Necesitan decisión de producto:**
- **F2 — el banner de portada.** Hoy se gana autonomía del operador (sube imágenes desde Vitrina) y se pierde el precio y el CTA sobre el producto destacado.
- **F3 — la segunda fila del header.** Las categorías aparecen dos veces en la portada, y se perdió el acceso directo a ofertas.

**Planificados:** F1 (filtros de catálogo, S6) · F6 (Categorías en el nav) · F7 (columna de canal, al construir el POS) · F8 (verificar el acento tipográfico).

Corregido el 7 ago en el change `correcciones-fidelidad-escritorio`: D1, D2, F4, F5.

---

## Anexo — segunda pasada (7 ago, tras revisión de Daniel)

La primera pasada **se saltó la cuenta del comprador** (`/cuenta`). Daniel la señaló. Añadidos aquí sus hallazgos y los de la tarjeta de producto.

### 🔴 D3 · La cuenta muestra el número interno del pedido, no el código del pedido — ✅ CORREGIDO

**Dónde:** `src/app/(tienda)/cuenta/page.tsx` y `cuenta/pedidos/[numero]/page.tsx`.

Mostraban `Pedido {p.number}` — el autoincremento de la base: **"Pedido 1"**, **"Pedido 2"**. El código real del pedido es `KO-2026-00223`, y lo produce `formatOrderNumber()`, que ya se usa en el checkout y en el mensaje de WhatsApp.

**Por qué importa más que en el panel:** en KORA el pedido se confirma y se paga **por WhatsApp**. Ese número es cómo el operador lo encuentra. Un comprador escribiendo *"hola, sobre mi pedido 2"* le da al operador un dato que no existe en su panel — el admin muestra `KO-2026-00223`. Rompe el único canal donde la venta se cierra.

Es el mismo defecto que D1 con otra cara: un valor interno de la base filtrándose a la pantalla.

### 🟡 D4 · La cuenta tiene su propio vocabulario de estados — deliberado, pero frágil

`cuenta/ui.tsx` define su propia tabla: `PENDING` → **"Por confirmar"**, mientras el panel dice **"Pendiente"**.

**Está razonado en el código y el razonamiento es bueno:** *"un pedido pendiente NO es un error, es el estado normal de una compra recién hecha. Si la cuenta no lo dice, el comprador cree que su compra falló y la repite."* Vocabulario para el comprador ≠ vocabulario para el operador.

Se deja como está. Pero son **dos tablas de etiquetas**, y si mañana se añade un estado hay que acordarse de las dos. Anotado para que la próxima persona no lo lea como un descuido.

### 🟡 F9 · La cuenta no tenía la estructura del prototipo — ✅ CORREGIDO

El prototipo §7 especifica **barra lateral** (avatar con inicial, nombre/email, pestañas, cerrar sesión) + contenido por pestañas. Había una sola columna con todo apilado: saludo, cashback, pedidos, datos y contraseña.

Reconstruida con la barra lateral y tres pestañas —**Mis pedidos · Kora Cashback · Mis datos**— controladas por URL (`?seccion=`), como el resto de la aplicación. En móvil la barra se convierte en cabecera más pestañas desplazables.

**Favoritos** y **Direcciones**, que el prototipo incluye, siguen fuera: favoritos no está en el alcance, y el comprador tiene una sola dirección que se edita en "Mis datos".

### 🔴 D5 · Las fotos de producto se iban a recortar — ✅ CORREGIDO

**Dónde:** `src/modules/storefront/product-card.tsx`.

El contenedor de la foto era de altura fija (170 px) con `object-cover`. `cover` **recorta** la imagen para llenar el hueco, y en un packshot lo que recorta es el producto: una licuadora alta pierde la jarra, un teclado ancho pierde las teclas de los extremos.

**Hoy es invisible porque no hay ni una foto cargada.** Se habría visto en *todas* las tarjetas el día que llegue el catálogo real del cliente — es decir, el día de la entrega.

**No era solo la tarjeta: estaba en DIEZ sitios.** Al buscarlo aparecieron el mismo recorte en las miniaturas de la galería de la ficha, la fila compacta del home, el panel de ofertas, el carrito, el panel lateral del carrito, el checkout, el listado de productos del panel, el selector de productos de Vitrina, su modal de secciones y el previsualizador de subida.

Corregido en los diez a contenedor con `object-contain` y margen interior; la tarjeta pasa además a contenedor **cuadrado**. Verificado con una foto de prueba ancha: entra completa. **Fijado por `tests/product-photo.test.ts`**, que recorre todos los `.tsx` de `src/` y falla si alguno vuelve a recortar una foto de producto — con una lista explícita de los cuatro archivos de **banner**, donde `cover` sí es lo correcto porque son artes diseñadas para llenar su hueco.

Corrección a lo que escribí antes: la **imagen principal** de la ficha ya usaba `contain` y estaba bien. Eran sus miniaturas. Se añadió además el **porcentaje de ahorro** arriba a la derecha, derivado del precio resuelto y no de un campo editable, y una señal *"Ver producto"* al pasar el cursor —solo con puntero fino, porque en táctil no hay hover y sería un botón fantasma—.

**Lo que NO se copió de la referencia que pasó Daniel** (SmartJoys): la columna de iconos al pasar el cursor —comparar, vista rápida, lista de deseos—. Son tres funciones que KORA no tiene, y pintar un icono que no hace nada es peor que no pintarlo. Si alguna se quiere de verdad, es alcance nuevo y se cotiza.
