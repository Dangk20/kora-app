# Auditoría de fidelidad — escritorio

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

### D1 · El dashboard muestra el estado del pedido en inglés y en crudo

**Dónde:** `src/app/admin/page.tsx:249` — tabla *Últimos pedidos*.

La columna **ESTADO** imprime `{o.status}`, es decir el enum de la base: **`CONFIRMED`**, **`PREPARING`**. En un panel en español que el cliente usa a diario.

Lo llamativo es que **el sistema ya sabe hacerlo bien**: `STATUS_LABEL` existe en `src/modules/orders/status.ts:16` y lo usan `pedidos/page.tsx:158`, `pedidos/[id]/page.tsx:82` y `order-actions.tsx:88`. La pantalla de Pedidos muestra *"Confirmado"* y *"En preparación"* con su badge de color, correctamente. Solo el dashboard se saltó el formateador.

El prototipo especifica `statusStyle(status)` → badge de color por estado. Aquí no hay badge ni color: es texto gris.

**Impacto:** es la primera pantalla que ve el operador al entrar. Corregir es una línea.

### D2 · Las cards de producto llevan botón, contra la regla escrita del proyecto

**Dónde:** `src/modules/storefront/product-card.tsx:105-108`.

`CLAUDE.md:78` dice, textualmente:

> *"Las cards del catálogo **no llevan botón**: la compra se decide en la ficha."*

Y las cards llevan botón: **"Agregar"** si el producto es simple, **"Ver opciones"** si tiene variantes. Aparece en el catálogo y en *Productos destacados* del home.

No es un detalle de gusto. El diseño móvil nuevo (7 ago) evalúa exactamente esta decisión, elige la card sin botón, y da la razón:

> *"En KORA el pedido termina en WhatsApp y muchos productos tienen variantes: un 'agregar' desde la card genera carritos con la variante equivocada y fricción al corregirla."*

**Aquí hay que decidir, no solo corregir.** El prototipo de junio **sí** tiene botón en las cards del home; el diseño móvil de agosto dice que no. Las dos referencias son legítimas y se contradicen. Lo que no puede quedarse es el estado actual: una regla escrita en `CLAUDE.md` que el código incumple, porque a partir de ahí ninguna de las dos es fiable.

**Recomendación:** quitar el botón y alinear con el diseño nuevo, que además razona el caso concreto de KORA. Si se prefiere conservarlo, corregir `CLAUDE.md`.

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

### F4 · La ficha perdió el bloque de garantías

El prototipo pone, bajo los botones de compra, **tres garantías con icono**. Hoy hay una línea de texto: *"Completas tus datos y finalizas el pedido por WhatsApp."*

El home **sí** tiene la fila de garantías (con las tres que el negocio sostiene). Falta replicarlas en la ficha, que es donde se decide la compra.

### F5 · Orden de los botones de compra invertido

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

## Qué se propone hacer

**Corregir ya** (son pequeños y dos de ellos contradicen reglas escritas): D1, F4, F5.

**Decidir con Daniel** antes de tocar: D2 (botón en las cards — hay dos referencias que se contradicen), F2 (banner), F3 (fila del header).

**Planificar**: F1 (filtros, S6), F6, F7 (al construir el POS), F8 (verificar).

Lo que se corrija va en un change propio; esta auditoría es el insumo, no la implementación.
